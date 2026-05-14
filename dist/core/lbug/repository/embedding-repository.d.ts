import type { GraphNode } from './types.js';
import { EMBEDDING_TABLE_NAME, EMBEDDING_INDEX_NAME, CREATE_VECTOR_INDEX_QUERY, STALE_HASH_SENTINEL, EMBEDDING_DIMS } from '../schema.js';
import type { IVecDBProvider } from '../../vector-store/provider.js';
export interface EmbeddingRepository {
    /** Find all embeddable nodes from node tables */
    findUnprocessedNodes(limit: number): Promise<GraphNode[]>;
    /** Store embedding for a node */
    storeEmbedding(nodeId: string, embedding: number[], modelId?: string, dimensions?: number, hash?: string): Promise<void>;
    /** Batch store embeddings (chunk-aware: nodeId, chunkIndex, startLine, endLine, embedding, contentHash) */
    batchStoreEmbeddings(updates: Array<{
        nodeId: string;
        chunkIndex: number;
        startLine: number;
        endLine: number;
        embedding: number[];
        contentHash?: string;
    }>): Promise<void>;
    /** Delete embeddings for the given node IDs (DELETE-then-INSERT pattern for Kuzu vector-indexed rows) */
    deleteEmbeddingsByNodeId(nodeIds: string[]): Promise<void>;
    /** Semantic search via vector index — returns raw vector search results (nodeId, score) */
    semanticSearch(vector: number[], topK: number, maxDistance?: number): Promise<Array<{
        nodeId: string;
        chunkIndex: number;
        startLine: number;
        endLine: number;
        score: number;
    }>>;
    /** Count total embedded nodes */
    countEmbeddings(): Promise<number>;
    /** Fetch all embeddings for exact-scan fallback */
    getAllEmbeddingsForExactScan(): Promise<Array<{
        nodeId: string;
        chunkIndex: number;
        startLine: number;
        endLine: number;
        embedding: number[];
    }>>;
    /** Query nodes by label and IDs for metadata enrichment */
    queryNodesByIds(label: string, ids: string[]): Promise<Array<Record<string, unknown>>>;
    /** Check if vector extension is loaded and usable */
    isVectorIndexReady(): Promise<boolean>;
    /** Initialize vector extension and create vector index */
    initializeVectorIndex(): Promise<boolean>;
    /** Cleanup */
    dispose(): Promise<void>;
}
export declare class LadybugEmbeddingRepository implements EmbeddingRepository {
    private readonly executeQuery;
    private readonly executeWithReusedStatement;
    private readonly tableName;
    private readonly indexName;
    private readonly vectorProvider?;
    private initialized;
    constructor(executeQuery: (cypher: string) => Promise<any[]>, executeWithReusedStatement: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>, tableName?: string, indexName?: string, vectorProvider?: IVecDBProvider);
    findUnprocessedNodes(_limit: number): Promise<GraphNode[]>;
    storeEmbedding(nodeId: string, embedding: number[], _modelId?: string, _dimensions?: number, hash?: string): Promise<void>;
    batchStoreEmbeddings(updates: Array<{
        nodeId: string;
        chunkIndex: number;
        startLine: number;
        endLine: number;
        embedding: number[];
        contentHash?: string;
    }>): Promise<void>;
    deleteEmbeddingsByNodeId(nodeIds: string[]): Promise<void>;
    semanticSearch(vector: number[], topK: number, maxDistance?: number): Promise<Array<{
        nodeId: string;
        chunkIndex: number;
        startLine: number;
        endLine: number;
        score: number;
    }>>;
    countEmbeddings(): Promise<number>;
    getAllEmbeddingsForExactScan(): Promise<Array<{
        nodeId: string;
        chunkIndex: number;
        startLine: number;
        endLine: number;
        embedding: number[];
    }>>;
    queryNodesByIds(label: string, ids: string[]): Promise<Array<Record<string, unknown>>>;
    isVectorIndexReady(): Promise<boolean>;
    initializeVectorIndex(): Promise<boolean>;
    dispose(): Promise<void>;
}
export { EMBEDDING_TABLE_NAME, STALE_HASH_SENTINEL, EMBEDDING_DIMS, EMBEDDING_INDEX_NAME, CREATE_VECTOR_INDEX_QUERY };
export { loadVectorExtension } from '../lbug-adapter.js';
