import type { CachedEmbedding } from './types.js';
export interface CacheLoadResult {
    cachedEmbeddingNodeIds: Set<string>;
    cachedEmbeddings: CachedEmbedding[];
}
/**
 * Load cached embeddings from the existing LadybugDB before a rebuild.
 * Only runs when shouldLoadCache is true and existingMeta exists.
 */
export declare function loadEmbeddingCache(lbugPath: string, shouldLoadCache: boolean, hasExistingMeta: boolean, initLbug: (path: string) => Promise<any>, closeLbug: () => Promise<void>, log: (msg: string) => void, progress: (phase: string, pct: number, msg: string) => void): Promise<CacheLoadResult>;
/**
 * Restore cached embeddings after a database rebuild.
 * Checks dimension compatibility — discards cache if dimensions changed.
 */
export declare function restoreCachedEmbeddings(cachedEmbeddings: CachedEmbedding[], executeWithReusedStatement: any, log: (msg: string) => void, progress: (phase: string, pct: number, msg: string) => void): Promise<CacheLoadResult>;
