export type Device = 'wasm' | 'cpu' | 'cuda' | 'dml' | 'remote';
export interface IngestionOutput {
    graph: unknown;
    repoPath: string;
}
export interface LadybugStats {
    nodes: number;
    edges: number;
    communities?: number;
    processes?: number;
}
export interface EmbeddingConfig {
    modelId: string;
    dimensions: number;
    modelDir: string;
    backend: Device;
    allowRemoteModels: boolean;
    allowLocalModels: boolean;
}
export interface EmbeddingResult {
    semanticMode: 'vector-index' | 'exact-scan' | undefined;
    embeddingsCount: number;
}
export interface EmbeddingCache {
    embeddings: unknown[];
    nodeIds: Set<string>;
}
export interface AnalysisMetadata {
    repoPath: string;
    repoName: string;
    stats: LadybugStats & {
        files?: number;
        embeddings?: number;
    };
    pipelineResult: IngestionOutput | undefined;
    alreadyUpToDate: boolean;
}
export interface EmbeddingMode {
    shouldGenerateEmbeddings: boolean;
    shouldPreserveCache: boolean;
}
