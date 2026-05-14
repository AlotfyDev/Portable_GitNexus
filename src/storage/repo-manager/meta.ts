import fs from 'fs/promises';
import path from 'path';
import type { RepoMeta, IndexedRepo } from './types.js';
import { getStoragePaths } from './paths.js';

export const hasKuzuIndex = async (storagePath: string): Promise<boolean> => {
  try {
    await fs.stat(path.join(storagePath, 'kuzu'));
    return true;
  } catch {
    return false;
  }
};

export const cleanupOldKuzuFiles = async (
  storagePath: string,
): Promise<{ found: boolean; needsReindex: boolean }> => {
  const oldPath = path.join(storagePath, 'kuzu');
  const newPath = path.join(storagePath, 'lbug');
  try {
    await fs.stat(oldPath);
    let needsReindex = false;
    try {
      await fs.stat(newPath);
    } catch {
      needsReindex = true;
    }
    for (const suffix of ['', '.wal', '.lock']) {
      try {
        await fs.unlink(oldPath + suffix);
      } catch {}
    }
    try {
      await fs.rm(oldPath, { recursive: true, force: true });
    } catch {}
    return { found: true, needsReindex };
  } catch {
    return { found: false, needsReindex: false };
  }
};

export const loadMeta = async (storagePath: string): Promise<RepoMeta | null> => {
  try {
    const metaPath = path.join(storagePath, 'meta.json');
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw) as RepoMeta;
  } catch {
    return null;
  }
};

export const saveMeta = async (storagePath: string, meta: RepoMeta): Promise<void> => {
  await fs.mkdir(storagePath, { recursive: true });
  const metaPath = path.join(storagePath, 'meta.json');
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
};

export const hasIndex = async (repoPath: string): Promise<boolean> => {
  const { metaPath } = getStoragePaths(repoPath);
  try {
    await fs.access(metaPath);
    return true;
  } catch {
    return false;
  }
};

export const loadRepo = async (repoPath: string): Promise<IndexedRepo | null> => {
  const paths = getStoragePaths(repoPath);
  const meta = await loadMeta(paths.storagePath);
  if (!meta) return null;

  return {
    repoPath: path.resolve(repoPath),
    ...paths,
    meta,
  };
};

export const findRepo = async (startPath: string): Promise<IndexedRepo | null> => {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root) {
    const repo = await loadRepo(current);
    if (repo) return repo;
    current = path.dirname(current);
  }

  return null;
};
