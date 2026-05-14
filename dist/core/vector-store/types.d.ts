/** Provider capability flags */
export interface VectorStoreCapabilities {
    /** Supports cosine similarity search */
    readonly similaritySearch: boolean;
    /** Supports hybrid search (vector + keyword) */
    readonly hybridSearch: boolean;
    /** Can store arbitrary metadata alongside vectors */
    readonly metadata: boolean;
    /** Maximum vector dimensions supported (0 = unlimited) */
    readonly maxDimensions: number;
    /** Whether this provider persists data to disk */
    readonly persistent: boolean;
    /** Whether this provider works on Windows */
    readonly windowsCompatible: boolean;
    /** Whether this provider requires an external server process */
    readonly requiresExternalServer: boolean;
}
/** Single vector record to store */
export interface VectorRecord {
    id: string;
    vector: number[];
    metadata?: Record<string, unknown>;
}
/** Search result from vector store */
export interface SearchResult {
    id: string;
    score: number;
    metadata?: Record<string, unknown>;
}
/** Options for similarity search */
export interface SearchOptions {
    topK: number;
    minScore?: number;
    filter?: Record<string, unknown>;
}
/** Statistics about the vector store */
export interface VectorStoreStats {
    totalVectors: number;
    dimensions: number;
    provider: string;
}
