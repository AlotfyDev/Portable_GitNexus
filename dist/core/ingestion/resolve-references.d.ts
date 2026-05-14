/**
 * `resolveReferenceSites` — drain `ReferenceSite[]` from a finalized
 * `ScopeResolutionIndexes` into a `ReferenceIndex` by routing each site
 * through the appropriate scope-aware `Registry.lookup` (RFC §3.2 Phase 4).
 *
 * This is the missing producer that `emit-references.ts` (#925) was
 * waiting on. The two together form the registry-primary resolution
 * pipeline:
 *
 *     ScopeResolutionIndexes.referenceSites
 *        │  resolveReferenceSites
 *        ▼
 *     ReferenceIndex
 *        │  emitReferencesToGraph
 *        ▼
 *     graph: CALLS / ACCESSES / INHERITS / USES edges
 *
 * ## What this module does
 *
 *   - For each `ReferenceSite`, picks the registry by `kind`:
 *     · `call` / `inherits`        → MethodRegistry / ClassRegistry (call-form aware)
 *     · `read` / `write`           → FieldRegistry  (falls through to MethodRegistry for free names)
 *     · `type-reference`           → ClassRegistry
 *     · `import-use`               → all three (best-effort name-lookup)
 *   - Calls `Registry.lookup` with the site's `inScope`, optional
 *     explicit receiver, and arity.
 *   - Takes the top-ranked `Resolution` (best by confidence + tie-break
 *     cascade); folds it into a `Reference` record and bins by source scope.
 *
 * ## What this module does NOT do
 *
 *   - No AST walks. The `ReferenceSite[]` is already extracted.
 *   - No language switches. Per-language behavior flows through
 *     `RegistryProviders.arityCompatibility` (see `RegistryContext`).
 *   - No multi-candidate fan-out. We pick `[0]` per RFC §4.3 ("one-shot
 *     answer"). The full ranked list is preserved in the per-site
 *     resolution but not emitted as multiple edges; callers that want
 *     branch-on-ambiguity behavior should consume the registries directly.
 */
import { CLASS_KINDS, FIELD_KINDS, METHOD_KINDS, type ReferenceIndex, type RegistryProviders } from '../../_shared/index.js';
import type { ScopeResolutionIndexes } from './model/scope-resolution-indexes.js';
export interface ResolveReferencesInput {
    readonly scopes: ScopeResolutionIndexes;
    /** Provider hooks consumed by the registries (e.g. `arityCompatibility`). */
    readonly providers?: RegistryProviders;
}
export interface ResolveStats {
    readonly sitesProcessed: number;
    readonly referencesEmitted: number;
    /** Sites where `Registry.lookup` returned no candidates. */
    readonly unresolved: number;
}
export interface ResolveReferencesOutput {
    readonly referenceIndex: ReferenceIndex;
    readonly stats: ResolveStats;
}
/**
 * Resolve every `ReferenceSite` in `scopes.referenceSites` against the
 * matching registry and produce a `ReferenceIndex` keyed by source scope
 * + target def.
 */
export declare function resolveReferenceSites(input: ResolveReferencesInput): ResolveReferencesOutput;
export { CLASS_KINDS, METHOD_KINDS, FIELD_KINDS };
