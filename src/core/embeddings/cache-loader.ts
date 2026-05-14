import type { CachedEmbedding } from './types.js';
import { loadCachedEmbeddings } from '../lbug/lbug-adapter.js';
import { batchInsertEmbeddings } from './embedding-pipeline.js';

export interface CacheLoadResult {
  cachedEmbeddingNodeIds: Set<string>;
  cachedEmbeddings: CachedEmbedding[];
}

/**
 * Load cached embeddings from the existing LadybugDB before a rebuild.
 * Only runs when shouldLoadCache is true and existingMeta exists.
 */
export async function loadEmbeddingCache(
  lbugPath: string,
  shouldLoadCache: boolean,
  hasExistingMeta: boolean,
  initLbug: (path: string) => Promise<any>,
  closeLbug: () => Promise<void>,
  log: (msg: string) => void,
  progress: (phase: string, pct: number, msg: string) => void,
): Promise<CacheLoadResult> {
  const result: CacheLoadResult = {
    cachedEmbeddingNodeIds: new Set<string>(),
    cachedEmbeddings: [],
  };

  if (!shouldLoadCache || !hasExistingMeta) return result;

  try {
    progress('embeddings', 0, 'Caching embeddings...');
    await initLbug(lbugPath);
    const cached = await loadCachedEmbeddings();
    result.cachedEmbeddingNodeIds = cached.embeddingNodeIds;
    result.cachedEmbeddings = cached.embeddings;
    await closeLbug();
  } catch (err: any) {
    log(
      `Warning: could not load cached embeddings ` +
        `(${err?.message ?? String(err)}). ` +
        `Embeddings will not be preserved on this run.`,
    );
  }

  return result;
}

/**
 * Restore cached embeddings after a database rebuild.
 * Checks dimension compatibility — discards cache if dimensions changed.
 */
export async function restoreCachedEmbeddings(
  cachedEmbeddings: CachedEmbedding[],
  executeWithReusedStatement: any,
  log: (msg: string) => void,
  progress: (phase: string, pct: number, msg: string) => void,
): Promise<CacheLoadResult> {
  const result: CacheLoadResult = {
    cachedEmbeddingNodeIds: new Set<string>(),
    cachedEmbeddings: [],
  };

  if (cachedEmbeddings.length === 0) return result;

  const { EMBEDDING_DIMS } = await import('../lbug/schema.js');
  const cachedDims = cachedEmbeddings[0].embedding.length;

  if (cachedDims !== EMBEDDING_DIMS) {
    log(
      `Embedding dimensions changed (${cachedDims}d -> ${EMBEDDING_DIMS}d), discarding cache`,
    );
    return result;
  }

  progress('embeddings', 88, `Restoring ${cachedEmbeddings.length} cached embeddings...`);
  const EMBED_BATCH = 200;
  for (let i = 0; i < cachedEmbeddings.length; i += EMBED_BATCH) {
    const batch = cachedEmbeddings.slice(i, i + EMBED_BATCH);
    try {
      await batchInsertEmbeddings(executeWithReusedStatement, batch);
    } catch {
      /* some may fail if node was removed, that's fine */
    }
  }

  // Return the preserved data for use in incremental embedding mode
  result.cachedEmbeddingNodeIds = new Set(cachedEmbeddings.map(e => e.nodeId));
  result.cachedEmbeddings = cachedEmbeddings;
  return result;
}
