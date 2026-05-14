import fs from 'fs/promises';
import path from 'path';
import lbug from '@ladybugdb/core';
import { SCHEMA_QUERIES } from '../schema.js';
import { extensionManager } from '../extension-loader.js';
import {
  openLbugConnection,
  isDbBusyError,
  isOpenRetryExhausted,
  waitForWindowsHandleRelease,
} from '../lbug-config.js';
import { runWithSessionLock, DB_LOCK_RETRY_ATTEMPTS, DB_LOCK_RETRY_DELAY_MS } from './session-lock.js';
import { normalizeCopyPath } from './helpers/path-utils.js';
import { logger } from '../../logger.js';

export let conn: lbug.Connection | null = null;
export let db: lbug.Database | null = null;
export let currentDbPath: string | null = null;

let _ftsLoaded = false;
let _vectorExtensionLoaded = false;
export const ensuredFTSIndexes = new Set<string>();

export function getFtsLoaded(): boolean { return _ftsLoaded; }
export function setFtsLoaded(v: boolean) { _ftsLoaded = v; }

export function getVectorExtensionLoaded(): boolean { return _vectorExtensionLoaded; }
export function setVectorExtensionLoaded(v: boolean) { _vectorExtensionLoaded = v; }

export const getDatabase = (): lbug.Database | null => db;

export const initLbug = async (dbPath: string) => {
  return runWithSessionLock(() => ensureLbugInitialized(dbPath));
};

export const withLbugDb = async <T>(dbPath: string, operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DB_LOCK_RETRY_ATTEMPTS; attempt++) {
    try {
      return await runWithSessionLock(async () => {
        await ensureLbugInitialized(dbPath);
        return operation();
      });
    } catch (err) {
      lastError = err;
      if (!isDbBusyError(err) || isOpenRetryExhausted(err) || attempt === DB_LOCK_RETRY_ATTEMPTS) {
        throw err;
      }
      await runWithSessionLock(async () => {
        await safeClose();
        currentDbPath = null;
        _ftsLoaded = false;
        _vectorExtensionLoaded = false;
        ensuredFTSIndexes.clear();
      });
      await new Promise((resolve) => setTimeout(resolve, DB_LOCK_RETRY_DELAY_MS * attempt));
    }
  }
  throw lastError;
};

const ensureLbugInitialized = async (dbPath: string) => {
  if (conn && currentDbPath === dbPath) {
    return { db, conn };
  }
  await doInitLbug(dbPath);
  return { db, conn };
};

const doInitLbug = async (dbPath: string) => {
  if (conn || db) {
    await safeClose();
    currentDbPath = null;
    _ftsLoaded = false;
    _vectorExtensionLoaded = false;
    ensuredFTSIndexes.clear();
  }

  try {
    const stat = await fs.lstat(dbPath);
    if (stat.isSymbolicLink()) {
      await fs.unlink(dbPath);
    } else if (stat.isDirectory()) {
      const realPath = await fs.realpath(dbPath);
      const parentDir = path.dirname(dbPath);
      const realParent = await fs.realpath(parentDir);
      if (!realPath.startsWith(realParent + path.sep) && realPath !== realParent) {
        throw new Error(
          `Refusing to delete ${dbPath}: resolved path ${realPath} is outside storage directory`,
        );
      }
      await fs.rm(dbPath, { recursive: true, force: true });
    }
  } catch {
    // Path doesn't exist
  }

  const parentDir = path.dirname(dbPath);
  await fs.mkdir(parentDir, { recursive: true });

  const opened = await openLbugConnection(lbug, dbPath);
  db = opened.db;
  conn = opened.conn;

  for (const schemaQuery of SCHEMA_QUERIES) {
    try {
      await conn.query(schemaQuery);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !isDbBusyError(err)) {
        logger.warn(`⚠️ Schema creation warning: ${msg.slice(0, 120)}`);
      }
    }
  }

  try {
    const loaded = await extensionManager.ensure(
      (sql: string) => conn!.query(sql), 'fts', 'FTS', {},
    );
    if (loaded) _ftsLoaded = true;
  } catch {
    // Extension manager already logs failures
  }

  currentDbPath = dbPath;
  return { db, conn };
};

export const flushWAL = async (): Promise<void> => {
  if (!conn) return;
  try {
    await conn.query('CHECKPOINT');
  } catch {
    /* ignore */
  }
};

export const safeClose = async (): Promise<void> => {
  await flushWAL();
  const closingDbPath = currentDbPath;
  if (conn) {
    try {
      await conn.close();
    } catch {
      /* best-effort */
    }
    conn = null;
  }
  if (db) {
    try {
      await db.close();
    } catch {
      /* best-effort */
    }
    db = null;
  }
  if (process.platform === 'win32' && closingDbPath) {
    const released = await waitForWindowsHandleRelease(closingDbPath);
    if (!released) {
      logger.warn(
        { dbPath: closingDbPath },
        '⚠️ LadybugDB file handle still locked after close (Windows). If this repeats, check antivirus/Defender exclusions for the GitNexus storage directory.',
      );
    }
  }
};

export const closeLbug = async (): Promise<void> => {
  await safeClose();
  currentDbPath = null;
  _ftsLoaded = false;
  _vectorExtensionLoaded = false;
  ensuredFTSIndexes.clear();
};

export const isLbugReady = (): boolean => conn !== null && db !== null;
