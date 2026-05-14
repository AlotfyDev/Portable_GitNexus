import type { CachedEmbedding } from '../../embeddings/types.js';
export declare const loadCachedEmbeddings: () => Promise<{
    embeddingNodeIds: Set<string>;
    embeddings: CachedEmbedding[];
}>;
export declare const fetchExistingEmbeddingHashes: (execQuery: (cypher: string) => Promise<any[]>) => Promise<Map<string, string> | undefined>;
export declare const getEmbeddingTableName: () => string;
