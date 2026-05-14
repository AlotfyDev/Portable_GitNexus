import { conn } from './connection.js';
import { EMBEDDING_TABLE_NAME, STALE_HASH_SENTINEL } from '../schema.js';
import { isMissingColumnOrTableError } from './fts.js';
import type { CachedEmbedding } from '../../embeddings/types.js';
import { logger } from '../../logger.js';

export const loadCachedEmbeddings = async (): Promise<{
  embeddingNodeIds: Set<string>;
  embeddings: CachedEmbedding[];
}> => {
  if (!conn) {
    return { embeddingNodeIds: new Set(), embeddings: [] };
  }

  const embeddingNodeIds = new Set<string>();
  const embeddings: CachedEmbedding[] = [];
  try {
    try {
      const check = await conn.query(
        `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN e.nodeId AS nodeId, e.chunkIndex AS chunkIndex LIMIT 1`,
      );
      const checkResult = Array.isArray(check) ? check[0] : check;
      await checkResult.getAll();
    } catch {
      return { embeddingNodeIds: new Set(), embeddings: [] };
    }

    let rows: any;
    let hasContentHash = true;
    try {
      rows = await conn.query(
        `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN e.nodeId AS nodeId, e.chunkIndex AS chunkIndex, e.startLine AS startLine, e.endLine AS endLine, e.embedding AS embedding, e.contentHash AS contentHash`,
      );
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (isMissingColumnOrTableError(msg)) {
        hasContentHash = false;
        rows = await conn.query(
          `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN e.nodeId AS nodeId, e.chunkIndex AS chunkIndex, e.startLine AS startLine, e.endLine AS endLine, e.embedding AS embedding`,
        );
      } else {
        throw err;
      }
    }
    const result = Array.isArray(rows) ? rows[0] : rows;
    for (const row of await result.getAll()) {
      const nodeId = String(row.nodeId ?? row[0] ?? '');
      if (!nodeId) continue;
      embeddingNodeIds.add(nodeId);
      const embedding = row.embedding ?? row[4];
      if (embedding) {
        embeddings.push({
          nodeId,
          chunkIndex: Number(row.chunkIndex ?? row[1] ?? 0),
          startLine: Number(row.startLine ?? row[2] ?? 0),
          endLine: Number(row.endLine ?? row[3] ?? 0),
          embedding: Array.isArray(embedding)
            ? embedding.map(Number)
            : Array.from(embedding as any).map(Number),
          contentHash: hasContentHash ? (row.contentHash ?? row[5] ?? undefined) : undefined,
        });
      }
    }
  } catch {
    /* embedding table may not exist */
  }

  return { embeddingNodeIds, embeddings };
};

export const fetchExistingEmbeddingHashes = async (
  execQuery: (cypher: string) => Promise<any[]>,
): Promise<Map<string, string> | undefined> => {
  try {
    const rows = await execQuery(
      `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN e.nodeId AS nodeId, e.chunkIndex AS chunkIndex, e.startLine AS startLine, e.endLine AS endLine, e.contentHash AS contentHash`,
    );
    if (!rows || rows.length === 0) return undefined;
    const map = new Map<string, string>();
    for (const r of rows) {
      const nodeId = r.nodeId ?? r[0];
      const chunkIndex = r.chunkIndex ?? r[1];
      const startLine = r.startLine ?? r[2];
      const endLine = r.endLine ?? r[3];
      const hash = r.contentHash ?? r[4] ?? STALE_HASH_SENTINEL;
      if (nodeId) {
        const hasChunkMetadata =
          chunkIndex !== undefined &&
          chunkIndex !== null &&
          startLine !== undefined &&
          startLine !== null &&
          endLine !== undefined &&
          endLine !== null;
        map.set(nodeId, hasChunkMetadata && hash ? hash : STALE_HASH_SENTINEL);
      }
    }
    return map;
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (isMissingColumnOrTableError(msg)) {
      try {
        const rows = await execQuery(`MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN e.nodeId AS nodeId`);
        if (!rows || rows.length === 0) return undefined;
        const map = new Map<string, string>();
        for (const r of rows) {
          const nodeId = r.nodeId ?? r[0];
          if (nodeId) map.set(nodeId, STALE_HASH_SENTINEL);
        }
        logger.info(
          `[embed] ${map.size} nodes in legacy DB (missing chunk-aware columns) — all treated as stale`,
        );
        return map;
      } catch (fallbackErr: any) {
        const fallbackMsg = fallbackErr?.message ?? '';
        if (isMissingColumnOrTableError(fallbackMsg)) {
          logger.info(
            `[embed] CodeEmbedding table not yet present — full embedding run (${fallbackMsg})`,
          );
          return undefined;
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
};

export const getEmbeddingTableName = (): string => EMBEDDING_TABLE_NAME;
