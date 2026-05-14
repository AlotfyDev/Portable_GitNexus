import type { PipelineContract } from '../types.js';
import type { EmbeddingResult } from '../stages.js';
import type { CachedEmbedding } from '../../embeddings/types.js';
interface StageCacheData {
    cachedEmbeddings: CachedEmbedding[];
    cachedEmbeddingNodeIds: Set<string>;
}
export declare function getStageCache(): StageCacheData;
export declare function createEmbeddingStage(): PipelineContract<EmbeddingResult>;
export {};
