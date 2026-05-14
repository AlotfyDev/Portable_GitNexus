/**
 * Parse implementation — chunked parse + resolve loop.
 *
 * This is the core parsing engine of the ingestion pipeline. It reads
 * source files in byte-budget chunks (~20MB each), parses via worker
 * pool (or sequential fallback), resolves imports/calls/heritage per
 * chunk, and synthesizes wildcard import bindings.
 *
 * Consumed by the parse phase (`parse.ts`) — the phase file handles
 * dependency wiring while the heavy implementation lives here.
 *
 * @module
 */
import { BindingAccumulator } from '../binding-accumulator.js';
import { type ExportedTypeMap } from '../call-processor.js';
import { createResolutionContext } from '../model/resolution-context.js';
import { ASTCache } from '../ast-cache.js';
import { type PipelineProgress } from '../../../_shared/index.js';
import type { ExtractedDecoratorRoute, ExtractedFetchCall, ExtractedORMQuery, ExtractedRoute, ExtractedToolDef } from '../workers/parse-worker.js';
import type { KnowledgeGraph } from '../../graph/types.js';
import type { PipelineOptions } from '../pipeline.js';
type ScannedFile = {
    path: string;
    size: number;
};
type ProgressFn = (progress: PipelineProgress) => void;
/**
 * Chunked parse + resolve loop.
 *
 * Reads source in byte-budget chunks (~20MB each). For each chunk:
 * 1. Parse via worker pool (or sequential fallback)
 * 2. Resolve imports from extracted data
 * 3. Synthesize wildcard import bindings (Go/Ruby/C++/Swift/Python)
 * 4. Resolve heritage + routes per chunk; defer worker CALLS until all chunks
 *    have contributed heritage so interface-dispatch implementor map is complete
 * 5. Collect TypeEnv bindings for cross-file propagation
 */
export declare function runChunkedParseAndResolve(graph: KnowledgeGraph, scannedFiles: ScannedFile[], allPaths: string[], totalFiles: number, repoPath: string, pipelineStart: number, onProgress: ProgressFn, options?: PipelineOptions): Promise<{
    exportedTypeMap: ExportedTypeMap;
    allFetchCalls: ExtractedFetchCall[];
    allExtractedRoutes: ExtractedRoute[];
    allDecoratorRoutes: ExtractedDecoratorRoute[];
    allToolDefs: ExtractedToolDef[];
    allORMQueries: ExtractedORMQuery[];
    bindingAccumulator: BindingAccumulator;
    resolutionContext: ReturnType<typeof createResolutionContext>;
    usedWorkerPool: boolean;
    /** Cross-phase tree-sitter Tree cache populated by the sequential
     *  parse path. Distinct from the chunk-local `astCache` used inside
     *  the parse loop (that one is cleared between chunks). Empty when
     *  every chunk ran via the worker pool (workers can't return native
     *  tree-sitter Trees across the MessageChannel). Downstream phases
     *  (scope-resolution) read from this to skip re-parsing the same
     *  source. See plan
     *  docs/plans/2026-04-20-002-perf-parse-heritage-mro-plan.md (Unit 4). */
    scopeTreeCache: ASTCache;
}>;
export {};
