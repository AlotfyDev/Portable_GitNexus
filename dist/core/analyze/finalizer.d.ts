import type { AnalyzeOptions } from './types.js';
export interface FinalizeInput {
    repoPath: string;
    storagePath: string;
    currentCommit: string;
    options: AnalyzeOptions;
    pipelineResult: any;
    stats: {
        nodes: number;
        edges: number;
    };
    embeddingSkipped: boolean;
    embeddingCount: number;
    semanticMode: 'vector-index' | 'exact-scan' | undefined;
    existingMetaStats?: {
        files?: number;
        communities?: number;
        processes?: number;
    } | null;
}
export interface FinalizeOutput {
    projectName: string;
    meta: any;
    aggregatedClusterCount: number;
}
/**
 * Count persisted embeddings in the LadybugDB index.
 */
export declare function countEmbeddings(executeQuery: (cypher: string) => Promise<any>): Promise<number>;
/**
 * Compute aggregated cluster count from pipeline community results.
 */
export declare function computeClusterSummary(pipelineResult: any): number;
/**
 * Build the meta object with stats and capabilities.
 */
export declare function buildMeta(input: FinalizeInput, embeddingCount: number): Promise<{
    meta: any;
    projectName: string;
    aggregatedClusterCount: number;
}>;
