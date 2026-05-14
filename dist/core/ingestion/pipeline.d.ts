/**
 * Pipeline orchestrator — dependency-ordered ingestion pipeline.
 *
 * The pipeline is composed of named phases with explicit dependencies.
 * Each phase is defined in its own file under `pipeline-phases/`.
 * The runner in `pipeline-phases/runner.ts` executes phases in
 * topological order, passing typed outputs from upstream phases as
 * inputs to downstream phases.
 *
 * To add a new phase:
 * 1. Create a new file in `pipeline-phases/` following the pattern
 * 2. Export it from `pipeline-phases/index.ts`
 * 3. Add it to the `ALL_PHASES` array below
 *
 * See ARCHITECTURE.md for the full phase dependency diagram.
 */
import { type PipelineProgress } from '../../_shared/index.js';
import { PipelineResult } from '../../types/pipeline.js';
export interface PipelineOptions {
    /** Skip MRO, community detection, and process extraction for faster test runs. */
    skipGraphPhases?: boolean;
    /** Force sequential parsing (no worker pool). Useful for testing the sequential path. */
    skipWorkers?: boolean;
    /**
     * @internal Test-only override for worker-pool gating thresholds.
     * When unset, production defaults apply (15 files OR 512 KB total bytes).
     * Setting either field lowers the corresponding threshold so small test
     * fixtures can still exercise the worker-pool path. Do not use from
     * production call sites.
     */
    workerThresholdsForTest?: {
        minFiles?: number;
        minBytes?: number;
    };
}
export declare const runPipelineFromRepo: (repoPath: string, onProgress: (progress: PipelineProgress) => void, options?: PipelineOptions) => Promise<PipelineResult>;
