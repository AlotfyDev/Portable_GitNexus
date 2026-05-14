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
import { buildClassRegistry, buildFieldRegistry, buildMethodRegistry, CLASS_KINDS, FIELD_KINDS, METHOD_KINDS, } from '../../_shared/index.js';
/**
 * Resolve every `ReferenceSite` in `scopes.referenceSites` against the
 * matching registry and produce a `ReferenceIndex` keyed by source scope
 * + target def.
 */
export function resolveReferenceSites(input) {
    const { scopes } = input;
    const providers = input.providers ?? {};
    const ctx = {
        scopes: scopes.scopeTree,
        defs: scopes.defs,
        qualifiedNames: scopes.qualifiedNames,
        moduleScopes: scopes.moduleScopes,
        methodDispatch: scopes.methodDispatch,
        providers,
    };
    const classRegistry = buildClassRegistry(ctx);
    const methodRegistry = buildMethodRegistry(ctx);
    const fieldRegistry = buildFieldRegistry(ctx);
    // bySourceScope is the canonical index; byTargetDef is derived from it.
    const bySourceScope = new Map();
    const byTargetDef = new Map();
    let sitesProcessed = 0;
    let referencesEmitted = 0;
    let unresolved = 0;
    for (const site of scopes.referenceSites) {
        sitesProcessed++;
        const resolutions = lookupForSite(site, classRegistry, methodRegistry, fieldRegistry);
        if (resolutions.length === 0) {
            unresolved++;
            continue;
        }
        const top = resolutions[0];
        const ref = buildReference(site, top);
        referencesEmitted++;
        let bySource = bySourceScope.get(site.inScope);
        if (bySource === undefined) {
            bySource = [];
            bySourceScope.set(site.inScope, bySource);
        }
        bySource.push(ref);
        let byTarget = byTargetDef.get(top.def.nodeId);
        if (byTarget === undefined) {
            byTarget = [];
            byTargetDef.set(top.def.nodeId, byTarget);
        }
        byTarget.push(ref);
    }
    // Freeze inner arrays so consumers don't accidentally mutate.
    const frozenBySource = new Map();
    for (const [k, v] of bySourceScope)
        frozenBySource.set(k, Object.freeze([...v]));
    const frozenByTarget = new Map();
    for (const [k, v] of byTargetDef)
        frozenByTarget.set(k, Object.freeze([...v]));
    return {
        referenceIndex: { bySourceScope: frozenBySource, byTargetDef: frozenByTarget },
        stats: { sitesProcessed, referencesEmitted, unresolved },
    };
}
// ─── Internal ───────────────────────────────────────────────────────────────
/**
 * Pick the right registry for the site's `kind` and call `lookup`.
 *
 * The kind→registry mapping mirrors `mapKindToType` in `emit-references.ts`:
 *
 *   | site.kind        | primary registry  | acceptedKinds source         |
 *   |------------------|-------------------|------------------------------|
 *   | `call`           | MethodRegistry    | METHOD_KINDS (Method/Func/Ctor)
 *   | `inherits`       | ClassRegistry     | CLASS_KINDS                  |
 *   | `type-reference` | ClassRegistry     | CLASS_KINDS                  |
 *   | `read`/`write`   | FieldRegistry     | FIELD_KINDS                  |
 *   | `import-use`     | tiered fallback   | METHOD ∪ CLASS ∪ FIELD       |
 *
 * `import-use` doesn't have a single registry — the imported name might
 * be a class, a function, or a constant. Try each in priority order and
 * return the first non-empty result. Provenance still flows through the
 * scope's `bindings` (Step 1 lexical hit), so the lookup is correct
 * regardless of which registry surfaces the def.
 */
function lookupForSite(site, classRegistry, methodRegistry, fieldRegistry) {
    switch (site.kind) {
        case 'call': {
            const opts = {
                ...(site.arity !== undefined ? { callsite: { arity: site.arity } } : {}),
                ...(site.explicitReceiver !== undefined ? { explicitReceiver: site.explicitReceiver } : {}),
            };
            return methodRegistry.lookup(site.name, site.inScope, opts);
        }
        case 'inherits':
        case 'type-reference': {
            return classRegistry.lookup(site.name, site.inScope);
        }
        case 'read':
        case 'write': {
            // Try field first; fall through to method then class so bare-name
            // reads of a function (e.g. `cb = save`) still resolve.
            const fieldHits = fieldRegistry.lookup(site.name, site.inScope);
            if (fieldHits.length > 0)
                return fieldHits;
            const methodHits = methodRegistry.lookup(site.name, site.inScope);
            if (methodHits.length > 0)
                return methodHits;
            return classRegistry.lookup(site.name, site.inScope);
        }
        case 'import-use': {
            // Try class, method, then field. The lexical-hit Step 1 in
            // `lookupCore` handles the actual binding lookup; the choice of
            // registry only narrows `acceptedKinds`.
            const classHits = classRegistry.lookup(site.name, site.inScope);
            if (classHits.length > 0)
                return classHits;
            const methodHits = methodRegistry.lookup(site.name, site.inScope);
            if (methodHits.length > 0)
                return methodHits;
            return fieldRegistry.lookup(site.name, site.inScope);
        }
    }
}
/** Compose a `Reference` record from a site + its top resolution. */
function buildReference(site, top) {
    return {
        fromScope: site.inScope,
        toDef: top.def.nodeId,
        atRange: site.atRange,
        kind: site.kind,
        confidence: top.confidence,
        evidence: top.evidence,
    };
}
// Re-export the kind sets so consumers don't have to import them
// separately when constructing custom resolution flows. The mappings
// stay in `gitnexus-shared` (single source of truth); this is a
// convenience pass-through only.
export { CLASS_KINDS, METHOD_KINDS, FIELD_KINDS };
