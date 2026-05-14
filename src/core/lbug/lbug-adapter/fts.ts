import { conn, ensuredFTSIndexes } from './connection.js';
import { getFtsLoaded, setFtsLoaded } from './connection.js';
import { extensionManager, type ExtensionEnsureOptions } from '../extension-loader.js';
import { logger } from '../../logger.js';

const ftsIndexKey = (tableName: string, indexName: string): string => `${tableName}:${indexName}`;

export const isMissingColumnOrTableError = (msg: string): boolean =>
  msg.includes('does not exist') ||
  /(table|column|property).*not found/i.test(msg);

export const loadFTSExtension = async (
  targetConn?: import('@ladybugdb/core').Connection,
  opts: ExtensionEnsureOptions = {},
): Promise<boolean> => {
  const useModuleState = targetConn === undefined;
  if (useModuleState && getFtsLoaded()) return true;

  const c = targetConn ?? conn;
  if (!c) {
    throw new Error('LadybugDB not initialized. Call initLbug first.');
  }

  const loaded = await extensionManager.ensure((sql: string) => c.query(sql), 'fts', 'FTS', opts);
  if (loaded && useModuleState) setFtsLoaded(true);
  return loaded;
};

export const createFTSIndex = async (
  tableName: string,
  indexName: string,
  properties: string[],
  stemmer: string = 'porter',
): Promise<void> => {
  if (!conn) {
    throw new Error('LadybugDB not initialized. Call initLbug first.');
  }

  const key = ftsIndexKey(tableName, indexName);
  if (ensuredFTSIndexes.has(key)) return;

  if (!(await loadFTSExtension())) {
    return;
  }

  const propList = properties.map((p) => `'${p}'`).join(', ');
  const query = `CALL CREATE_FTS_INDEX('${tableName}', '${indexName}', [${propList}], stemmer := '${stemmer}')`;

  try {
    await conn.query(query);
    ensuredFTSIndexes.add(key);
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      ensuredFTSIndexes.add(key);
      return;
    }
    throw e;
  }
};

export const ensureFTSIndex = async (
  tableName: string,
  indexName: string,
  properties: string[],
  stemmer: string = 'porter',
): Promise<void> => {
  const key = ftsIndexKey(tableName, indexName);
  if (ensuredFTSIndexes.has(key)) return;
  try {
    await createFTSIndex(tableName, indexName, properties, stemmer);
  } catch (e) {
    const { isReadOnlyDbError } = await import('./session-lock.js');
    if (isReadOnlyDbError(e)) {
      ensuredFTSIndexes.add(key);
      return;
    }
    throw e;
  }
};

export const queryFTS = async (
  tableName: string,
  indexName: string,
  query: string,
  limit: number = 20,
  conjunctive: boolean = false,
): Promise<
  Array<{ nodeId: string; name: string; filePath: string; score: number; [key: string]: any }>
> => {
  if (!conn) {
    throw new Error('LadybugDB not initialized. Call initLbug first.');
  }

  const escapedQuery = query.replace(/\\/g, '\\\\').replace(/'/g, "''");

  const cypher = `
    CALL QUERY_FTS_INDEX('${tableName}', '${indexName}', '${escapedQuery}', conjunctive := ${conjunctive})
    RETURN node, score
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  try {
    const queryResult = await conn.query(cypher);
    const result = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    const rows = await result.getAll();

    return rows.map((row: any) => {
      const node = row.node || row[0] || {};
      const score = row.score ?? row[1] ?? 0;
      return {
        nodeId: node.nodeId || node.id || '',
        name: node.name || '',
        filePath: node.filePath || '',
        score: typeof score === 'number' ? score : parseFloat(score) || 0,
        ...node,
      };
    });
  } catch (e: any) {
    if (e.message?.includes('does not exist')) {
      return [];
    }
    throw e;
  }
};

export const dropFTSIndex = async (tableName: string, indexName: string): Promise<void> => {
  if (!conn) {
    throw new Error('LadybugDB not initialized. Call initLbug first.');
  }

  try {
    await conn.query(`CALL DROP_FTS_INDEX('${tableName}', '${indexName}')`);
  } catch {
    // Index may not exist
  } finally {
    ensuredFTSIndexes.delete(ftsIndexKey(tableName, indexName));
  }
};
