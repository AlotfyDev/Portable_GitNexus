import type { PipelineContract, PipelineId, PipelineRunner } from './types.js';
export declare function createPipelineRunner(contracts: Map<PipelineId, PipelineContract>): PipelineRunner;
