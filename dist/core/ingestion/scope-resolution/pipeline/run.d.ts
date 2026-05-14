/**
 * `runScopeResolution` — generic registry-primary resolution
 * orchestrator.
 *
 *     ParsedFile[]  (one per file via `extractParsedFile`)
 *        │  finalizeScopeModel(  + provider hooks adapted to FinalizeHooks)
 *        ▼
 *     ScopeResolutionIndexes
 *        │  resolveReferenceSites
 *        ▼
 *     ReferenceIndex
 *        │  emitReceiverBoundCalls (FIRST — see Contract Invariant I1)
 *        │  emitFreeCallFallback   (THEN)
 *        │  emitReferencesViaLookup (LAST — uses handledSites)
 *        │  emitImportEdges
 *        ▼
 *     KnowledgeGraph
 *
 * Per-language entry points (e.g. `runPythonScopeResolution` in
 * `languages/python/scope-resolver.ts`) construct an `ScopeResolver` and
 * delegate here.
 *
 * Plan: `docs/plans/2026-04-20-001-refactor-emit-pipeline-generalization-plan.md`.
 */
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { MutableSemanticModel } from '../../model/semantic-model.js';
import { type ResolveStats } from '../../resolve-references.js';
import type { ScopeResolver } from '../contract/scope-resolver.js';
interface RunScopeResolutionInput {
    readonly graph: KnowledgeGraph;
    /**
     * Semantic model populated by the legacy `parse` phase. Scope-
     * resolution consumes its `TypeRegistry` / `MethodRegistry` /
     * `SymbolTable` lookups instead of rebuilding parallel indexes from
     * `ParsedFile[]`. See ARCHITECTURE.md § "Semantic-model source of
     * truth". Tests that invoke `runScopeResolution` in isolation pass a
     * freshly-created `MutableSemanticModel` populated from the same
     * `ParsedFile[]` to mirror the pipeline shape.
     */
    readonly model: MutableSemanticModel;
    readonly files: readonly {
        readonly path: string;
        readonly content: string;
    }[];
    readonly onWarn?: (message: string) => void;
    /**
     * Optional pre-parsed-Tree lookup keyed by file path. When the
     * pipeline's parse phase ran sequentially, it populated an
     * `ASTCache`; passing that here lets the per-file extract step
     * skip a second `tree-sitter parser.parse(...)` call. Cache miss
     * is safe — falls back to a fresh parse inside the provider.
     */
    readonly treeCache?: {
        get(filePath: string): unknown;
    };
    /**
     * Opaque per-language import-resolution config (e.g. tsconfig path
     * aliases for TypeScript). Loaded once by the caller via
     * `provider.loadResolutionConfig(repoPath)` and threaded into every
     * `provider.resolveImportTarget` call. `undefined` when the
     * provider doesn't supply a config loader.
     */
    readonly resolutionConfig?: unknown;
}
interface RunScopeResolutionStats {
    readonly filesProcessed: number;
    readonly filesSkipped: number;
    readonly importsEmitted: number;
    readonly resolve: ResolveStats;
    readonly referenceEdgesEmitted: number;
    readonly referenceSkipped: number;
}
export declare function runScopeResolution(input: RunScopeResolutionInput, provider: ScopeResolver): RunScopeResolutionStats;
export {};
