/**
 * Embedding Pipeline Module
 *
 * Orchestrates the background embedding process:
 * 1. Query embeddable nodes from LadybugDB
 * 2. Generate text representations with enriched metadata
 * 3. Chunk long nodes, batch embed
 * 4. Update LadybugDB with chunk-aware embeddings
 * 5. Create vector index for semantic search
 */
import { type EmbeddingProgress, type EmbeddingConfig, type EmbeddableNode, type SemanticSearchResult, type EmbeddingContext } from './types.js';
import { type EmbeddingRepository } from '../lbug/repository/embedding-repository.js';
/**
 * Bump this when the embedding text template changes in a way that should
 * invalidate existing vectors, such as metadata/header shape changes,
 * structural container context changes, or preceding-context formatting rules.
 */
export declare const EMBEDDING_TEXT_VERSION = "v2";
/**
 * Compute a stable content fingerprint for an embeddable node.
 * Used to detect when the underlying text has changed so stale vectors
 * can be replaced (DELETE-then-INSERT, the Kuzu-sanctioned pattern for
 * vector-indexed rows).
 */
export declare const contentHashForNode: (node: EmbeddableNode, config?: Partial<EmbeddingConfig>) => string;
/**
 * Progress callback type
 */
export type EmbeddingProgressCallback = (progress: EmbeddingProgress) => void;
/**
 * Batch INSERT chunk-aware embeddings into CodeEmbedding table
 */
export declare const batchInsertEmbeddings: (executorOrRepo: ((cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>) | EmbeddingRepository, updates: Array<{
    nodeId: string;
    chunkIndex: number;
    startLine: number;
    endLine: number;
    embedding: number[];
    contentHash?: string;
}>) => Promise<void>;
export interface EmbeddingPipelineResult {
    nodesProcessed: number;
    chunksProcessed: number;
    vectorIndexReady: boolean;
    semanticMode: 'vector-index' | 'exact-scan';
}
/**
 * Run the embedding pipeline
 *
 * @param executeQuery - Function to execute Cypher queries against LadybugDB
 * @param executeWithReusedStatement - Function to execute with reused prepared statement
 * @param onProgress - Callback for progress updates
 * @param config - Optional configuration override
 * @param skipNodeIds - Optional set of node IDs that already have embeddings (incremental mode)
 * @param context - Optional repo/server context for metadata enrichment
 * @param existingEmbeddings - Optional map of nodeId → contentHash for incremental mode.
 *        Nodes whose hash matches are skipped; nodes with a changed hash are DELETE'd
 *        and re-embedded; nodes not in the map are embedded fresh.
 * @param embeddingRepo - Optional EmbeddingRepository for abstracted DB access.
 *        When provided, replaces all inline Cypher with repository method calls.

 */
export declare const runEmbeddingPipeline: (executeQuery: (cypher: string) => Promise<any[]>, executeWithReusedStatement: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>, onProgress: EmbeddingProgressCallback, config?: Partial<EmbeddingConfig>, skipNodeIds?: Set<string>, context?: EmbeddingContext, existingEmbeddings?: Map<string, string>, embeddingRepo?: EmbeddingRepository) => Promise<EmbeddingPipelineResult>;
/**
 * Perform semantic search using the vector index with chunk deduplication
 */
export declare const semanticSearch: (queryExecutorOrRepo: ((cypher: string) => Promise<any[]>) | EmbeddingRepository, query: string, k?: number, maxDistance?: number) => Promise<SemanticSearchResult[]>;
/**
 * Semantic search with graph expansion (flattened results)
 */
export declare const semanticSearchWithContext: (queryExecutorOrRepo: ((cypher: string) => Promise<any[]>) | EmbeddingRepository, query: string, k?: number, _hops?: number) => Promise<any[]>;
