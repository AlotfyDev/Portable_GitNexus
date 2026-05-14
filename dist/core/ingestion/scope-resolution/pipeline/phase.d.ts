/**
 * Phase: scopeResolution
 *
 * Generic registry-primary resolution phase (RFC #909 Ring 3).
 *
 * For every language in `MIGRATED_LANGUAGES` (per-language flag set)
 * whose provider is registered in `SCOPE_RESOLVERS`:
 *   1. Filter scanned files by language extension.
 *   2. Read file contents.
 *   3. Drive the scope-based pipeline end-to-end via the generic
 *      `runScopeResolution(input, provider)` orchestrator.
 *   4. Emit IMPORTS / CALLS / ACCESSES / INHERITS / USES edges.
 *
 * Pairs with the per-language gates in `import-processor.ts` and
 * `call-processor.ts` that skip files when their language is registry-
 * primary, so we don't double-emit edges from both code paths.
 *
 * Adding a language is two changes:
 *   - Implement `ScopeResolver` in `languages/<lang>/scope-resolver.ts`
 *     and register it in `scope-resolution/pipeline/registry.ts`.
 *   - Add the language to `MIGRATED_LANGUAGES` in
 *     `registry-primary-flag.ts`.
 *
 * @deps    parse  (needs Symbol nodes already in the graph so emit-references
 *                  can attach edges to existing Function/Method/Class nodes)
 * @reads   scannedFiles
 * @writes  graph (IMPORTS, CALLS, ACCESSES, INHERITS, USES)
 */
import type { PipelinePhase } from '../../pipeline-phases/types.js';
import { SupportedLanguages } from '../../../../_shared/index.js';
export interface ScopeResolutionOutput {
    /** True when at least one language ran. */
    readonly ran: boolean;
    /** Files seen across all languages. `0` when `ran === false`. */
    readonly filesProcessed: number;
    /** IMPORTS edges emitted across all languages. */
    readonly importsEmitted: number;
    /** Reference (CALLS / ACCESSES / INHERITS / USES) edges emitted. */
    readonly referenceEdgesEmitted: number;
    /** Per-language breakdown for telemetry / shadow-parity. */
    readonly perLanguage: ReadonlyMap<SupportedLanguages, {
        readonly filesProcessed: number;
        readonly importsEmitted: number;
        readonly referenceEdgesEmitted: number;
    }>;
}
export declare const scopeResolutionPhase: PipelinePhase<ScopeResolutionOutput>;
