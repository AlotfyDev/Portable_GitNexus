/**
 * Emit CALLS edges for free-call reference sites whose target is
 * imported (or otherwise visible only via post-finalize scope.bindings).
 *
 * The shared `MethodRegistry.lookup` only consults `scope.bindings`
 * (pre-finalize / local-only) for free calls. Cross-file imports land
 * in `indexes.bindings` (post-finalize). Without this fallback, every
 * `from x import f; f()` resolves to "unresolved".
 *
 * **Free-call dedup contract (Contract Invariant I2):** free calls
 * collapse to one CALLS edge per (caller, target) pair regardless of
 * how many call sites the caller contains. Mirrors the legacy DAG's
 * dedup semantics (what the `default-params` / `variadic` / `overload`
 * fixtures expect). Member calls keep position-based dedup elsewhere.
 *
 * Generic; promoted from `languages/python/scope-resolver.ts` per the scope-resolution
 * generalization plan.
 */
import type { ParsedFile, Reference, ScopeId } from '../../../../_shared/index.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { SemanticModel } from '../../model/semantic-model.js';
import type { WorkspaceResolutionIndex } from '../workspace-index.js';
import type { GraphNodeLookup } from '../graph-bridge/node-lookup.js';
export declare function emitFreeCallFallback(graph: KnowledgeGraph, scopes: ScopeResolutionIndexes, parsedFiles: readonly ParsedFile[], nodeLookup: GraphNodeLookup, _referenceIndex: {
    readonly bySourceScope: ReadonlyMap<ScopeId, readonly Reference[]>;
}, handledSites: Set<string>, model: SemanticModel, workspaceIndex: WorkspaceResolutionIndex, options?: {
    readonly allowGlobalFallback?: boolean;
}): number;
