/**
 * `finalize` — cross-file finalize algorithm for the SemanticModel
 * (RFC §3.2 Phase 2; Ring 2 SHARED #915).
 *
 * Pure logic that takes per-file parse output (`ParsedImport[]` +
 * `SymbolDefinition[]`) and returns:
 *
 *   - Linked `ImportEdge[]` per module scope, with `targetModuleScope` and
 *     `targetDefId` filled where resolvable; edges that could not be
 *     resolved within the hard fixpoint cap are marked
 *     `linkStatus: 'unresolved'`.
 *   - Materialized `bindings` per module scope — local defs merged with
 *     imported / wildcard-expanded / re-exported names via the provider's
 *     `mergeBindings` precedence.
 *   - The SCC condensation of the import graph, exposed so disjoint SCCs
 *     can be processed in parallel by callers that want that.
 *
 * The algorithm is **SCC-aware**: it runs Tarjan SCC over the file-level
 * import graph, processes SCCs in reverse-topological order (leaves
 * first), and within each SCC runs a bounded fixpoint link pass capped at
 * `N = |edges in SCC|`. Cyclic imports finalize without hanging; malformed
 * inputs are bounded by the cap.
 *
 * **No language-specific logic.** Target resolution, wildcard expansion,
 * and binding precedence all go through caller-supplied hooks
 * (`resolveImportTarget`, `expandsWildcardTo`, `mergeBindings`) that
 * match the LanguageProvider surface from #911.
 *
 * **Non-binding imports rule.** `dynamic-unresolved` passes through with
 * `targetFile: null`; `dynamic-resolved` and `side-effect` resolve to
 * file-level `ImportEdge`s. None of these materialize `BindingRef`s.
 */
// ─── Entry point ───────────────────────────────────────────────────────────
export function finalize(input, hooks) {
    const byFilePath = new Map();
    for (const f of input.files)
        byFilePath.set(f.filePath, f);
    // ── Phase 0: pre-resolve raw import targets (one syscall-equivalent per
    // (file, parsedImport)). Edges with no resolvable target become
    // `linkStatus: 'unresolved'` or, for dynamic-unresolved, pass through
    // with `targetFile: null`.
    const edgeIndex = new Map(); // filePath → drafts
    let totalEdges = 0;
    for (const file of input.files) {
        const drafts = [];
        for (const parsed of file.parsedImports) {
            const draftArray = makeEdgeDrafts(parsed, file, hooks, input.workspaceIndex);
            drafts.push(...draftArray);
            totalEdges += draftArray.length;
        }
        edgeIndex.set(file.filePath, drafts);
    }
    // ── Phase 1: build file-level import graph (only resolvable edges form
    // graph edges; unresolvable ones are terminal and contribute no
    // fixpoint obligation).
    const graph = new Map();
    for (const file of input.files) {
        graph.set(file.filePath, new Set());
    }
    for (const [fromFile, drafts] of edgeIndex) {
        const edges = graph.get(fromFile);
        if (edges === undefined)
            continue;
        for (const d of drafts) {
            if (d.targetFile !== null && byFilePath.has(d.targetFile)) {
                edges.add(d.targetFile);
            }
        }
    }
    // ── Phase 2: Tarjan SCC → reverse-topological list of SCCs.
    const sccs = tarjanSccs(graph);
    // ── Phase 2.5: precompute the per-file re-export closure (iterative,
    // SCC-condensed). Eliminates the recursive crawl that the per-edge
    // `tryFinalize` call site used to do; lookups are O(1) afterwards.
    // See `buildReexportClosures` for the algorithm.
    const reexportClosures = buildReexportClosures(input.files, byFilePath, edgeIndex);
    // ── Phase 3: process SCCs in reverse-topological order (leaves first).
    // Within each SCC, run a bounded fixpoint that resolves intra-SCC edges.
    // Edges leaving the SCC are already resolved (their target SCC is
    // already finalized); edges inside the SCC may need multiple passes.
    const linkedByScope = new Map();
    let linkedEdges = 0;
    for (const scc of sccs) {
        const sccFiles = new Set(scc.files);
        const capacity = countEdgesWithin(edgeIndex, sccFiles);
        // Run the fixpoint up to `capacity` iterations. Each iteration tries to
        // resolve every still-unlinked edge in the SCC; stops early if a pass
        // makes no progress.
        let progressed = true;
        let iterations = 0;
        while (progressed && iterations < capacity) {
            progressed = false;
            iterations++;
            for (const filePath of scc.files) {
                const drafts = edgeIndex.get(filePath);
                if (drafts === undefined)
                    continue;
                for (const draft of drafts) {
                    if (draft.finalized !== null)
                        continue;
                    const finalized = tryFinalize(draft, byFilePath, reexportClosures);
                    if (finalized !== null) {
                        draft.finalized = finalized;
                        progressed = true;
                    }
                }
            }
        }
        // Any drafts still not finalized within this SCC hit the cap → unresolved.
        for (const filePath of scc.files) {
            const drafts = edgeIndex.get(filePath);
            if (drafts === undefined)
                continue;
            for (const draft of drafts) {
                if (draft.finalized !== null)
                    continue;
                draft.finalized = {
                    ...draft.base,
                    linkStatus: 'unresolved',
                };
            }
        }
    }
    // ── Phase 4: collect finalized `ImportEdge[]` per module scope, preserving
    // input order within each file, and wildcard-expand where applicable.
    for (const file of input.files) {
        const drafts = edgeIndex.get(file.filePath);
        if (drafts === undefined)
            continue;
        const finalized = [];
        for (const d of drafts) {
            const edge = d.finalized;
            if (edge === null) {
                throw new Error(`Invariant violated: import edge was not finalized for ${file.filePath}`);
            }
            if (d.source.kind === 'wildcard' && edge.linkStatus !== 'unresolved') {
                // Produce one `wildcard-expanded` ImportEdge per exported name.
                const expanded = expandWildcard(edge, byFilePath, hooks, input.workspaceIndex);
                for (const e of expanded)
                    finalized.push(e);
            }
            else {
                finalized.push(edge);
            }
            if (edge.linkStatus !== 'unresolved')
                linkedEdges++;
        }
        linkedByScope.set(file.moduleScope, Object.freeze(finalized));
    }
    // ── Phase 5: materialize module-scope bindings (local + imports + wildcards),
    // delegating precedence to `provider.mergeBindings`.
    const bindingsByScope = materializeBindings(input.files, linkedByScope, hooks);
    // ── Stats.
    const sccCount = sccs.length;
    let largestSccSize = 0;
    for (const scc of sccs) {
        if (scc.files.length > largestSccSize)
            largestSccSize = scc.files.length;
    }
    const stats = {
        totalFiles: input.files.length,
        totalEdges,
        linkedEdges,
        unresolvedEdges: totalEdges - linkedEdges,
        sccCount,
        largestSccSize,
    };
    return Object.freeze({
        imports: linkedByScope,
        bindings: bindingsByScope,
        sccs,
        stats,
    });
}
function makeEdgeDrafts(parsed, file, hooks, workspace) {
    // Dynamic-unresolved passes through — no `BindingRef`, no target file.
    if (parsed.kind === 'dynamic-unresolved') {
        const base = {
            localName: parsed.localName,
            targetFile: null,
            targetExportedName: '',
            kind: 'dynamic-unresolved',
        };
        return [
            {
                source: parsed,
                fromFile: file.filePath,
                fromScope: file.moduleScope,
                targetFile: null,
                base,
                finalized: base, // already fully finalized
            },
        ];
    }
    const targetFile = hooks.resolveImportTarget(parsed.targetRaw ?? '', file.filePath, workspace);
    // Edge is unresolvable at the file level — mark unresolved now.
    if (targetFile === null) {
        const base = {
            localName: extractLocalName(parsed),
            targetFile: null,
            targetExportedName: extractExportedName(parsed),
            kind: edgeKindFor(parsed),
            linkStatus: 'unresolved',
        };
        return [
            {
                source: parsed,
                fromFile: file.filePath,
                fromScope: file.moduleScope,
                targetFile: null,
                base,
                finalized: base,
            },
        ];
    }
    // Resolvable at the file level; intra-SCC fixpoint may still fail to fill
    // in `targetDefId` (e.g., symbol not exported from target). Side-effect
    // and resolved-dynamic imports are terminal at the file level — no
    // `targetDefId` needed since they materialize no `BindingRef`. Pre-
    // finalize them here so the fixpoint loop skips them entirely.
    const targetFiles = Array.isArray(targetFile) ? targetFile : [targetFile];
    const isFileLevelTerminal = parsed.kind === 'side-effect' || parsed.kind === 'dynamic-resolved';
    return targetFiles.map((tf) => {
        const base = {
            localName: extractLocalName(parsed),
            targetFile: tf,
            targetExportedName: extractExportedName(parsed),
            kind: edgeKindFor(parsed),
        };
        return {
            source: parsed,
            fromFile: file.filePath,
            fromScope: file.moduleScope,
            targetFile: tf,
            base,
            finalized: isFileLevelTerminal ? base : null,
        };
    });
}
function edgeKindFor(parsed) {
    if (parsed.kind === 'wildcard')
        return 'wildcard-expanded';
    return parsed.kind;
}
function extractLocalName(parsed) {
    switch (parsed.kind) {
        case 'wildcard':
        case 'side-effect':
        case 'dynamic-resolved':
            return '';
        default:
            return parsed.localName;
    }
}
function extractExportedName(parsed) {
    switch (parsed.kind) {
        case 'named':
        case 'alias':
        case 'namespace':
        case 'reexport':
            return parsed.importedName;
        case 'wildcard':
        case 'dynamic-unresolved':
        case 'dynamic-resolved':
        case 'side-effect':
            return '';
    }
}
// ─── Internal: per-edge finalization (phase 3) ─────────────────────────────
function tryFinalize(draft, byFilePath, reexportClosures) {
    const targetFile = draft.targetFile;
    if (targetFile === null)
        return draft.base; // already terminal
    const targetModule = byFilePath.get(targetFile);
    if (targetModule === undefined)
        return draft.base; // external target — leave as-is
    // Wildcards finalize at the file level; their per-name expansion happens
    // in phase 4. At this stage we just record the target module scope.
    if (draft.source.kind === 'wildcard') {
        return {
            ...draft.base,
            targetModuleScope: targetModule.moduleScope,
        };
    }
    // Namespace imports alias the target *module*; they don't name a
    // specific export. Link the module scope unconditionally. If the target
    // also exposes a def whose simple name matches `importedName` (some
    // languages emit a synthetic module-def), pick it up as the `targetDefId`
    // so consumers can reach the module as a symbol — but its absence is not
    // a failure.
    if (draft.source.kind === 'namespace') {
        const moduleDef = findExportByName(targetModule.localDefs, extractExportedName(draft.source));
        return {
            ...draft.base,
            targetModuleScope: targetModule.moduleScope,
            ...(moduleDef !== undefined ? { targetDefId: moduleDef.nodeId } : {}),
        };
    }
    // named / alias / reexport: look up the imported name in the target's
    // local defs. Multi-hop re-export chains settle iteratively — each hop
    // resolves once its prior hop is finalized.
    const importedName = extractExportedName(draft.source);
    const exported = findExportByName(targetModule.localDefs, importedName);
    if (exported !== undefined) {
        const transitiveVia = draft.source.kind === 'reexport' ? Object.freeze([targetFile]) : undefined;
        return {
            ...draft.base,
            targetModuleScope: targetModule.moduleScope,
            targetDefId: exported.nodeId,
            ...(transitiveVia !== undefined ? { transitiveVia } : {}),
        };
    }
    // Multi-hop re-export follow. Barrel modules like
    //   // models.ts
    //   export { User } from './base';
    // emit no local def for `User`; the name surfaces only via their own
    // `reexport` edge. The per-file re-export closure built in phase 2.5
    // already encodes every name reachable through that file's named and
    // wildcard re-exports — including transitively through cyclic SCCs —
    // so the lookup is O(1) and never recurses.
    const followed = lookupReexportedName(reexportClosures, targetFile, importedName);
    if (followed === null) {
        // Target resolvable but the name isn't exported — keep trying in case a
        // re-export inside the target's SCC surfaces it in a later iteration.
        return null;
    }
    const viaFiles = [targetFile, ...followed.via];
    const transitiveVia = draft.source.kind === 'reexport' || viaFiles.length > 1 ? Object.freeze(viaFiles) : undefined;
    return {
        ...draft.base,
        targetModuleScope: targetModule.moduleScope,
        targetDefId: followed.def.nodeId,
        ...(transitiveVia !== undefined ? { transitiveVia } : {}),
    };
}
/**
 * Build per-file re-export closures.
 *
 * **Algorithm.** Iterative SCC-condensed reverse-topological propagation,
 * structurally identical to how `finalize` itself processes the file-
 * level import graph. Replaces the legacy recursive
 * `followReexportChain` crawl with a bounded, stack-safe pass:
 *
 *   1. **Sub-graph.** Build a directed graph whose edges are
 *      `reexport` and `wildcard` drafts only (regular imports do not
 *      contribute to the export surface, and `namespace`/
 *      `reexport-namespace` are terminal — their target def lives in
 *      `localDefs`).
 *   2. **SCC condensation.** Run the same iterative `tarjanSccs` over
 *      the sub-graph. Output is in reverse-topological order (leaves
 *      first), so when we process an SCC every out-of-SCC neighbor
 *      already has its closure populated.
 *   3. **Per-SCC propagation.**
 *        * Acyclic singleton: one pass — read neighbors' (already
 *          fully populated) closures.
 *        * Cyclic SCC (cycle ≥ 2 files, or self-loop): bounded
 *          fixpoint inside the SCC, capped at `|SCC| + 1` iterations
 *          (each iteration propagates names one hop further around
 *          the cycle; first-wins precedence keeps the map monotone
 *          so the fixpoint converges in at most |SCC| hops).
 *
 * **Precedence semantics — preserved from the recursive crawl.**
 *   * Named re-exports take precedence over wildcards.
 *   * Within each kind, declaration order wins (first match for a
 *     given exported name is kept; later drafts skip).
 *
 * **Complexity.**
 *   * Pre-pass: O(V + E_re) for SCC, plus O(|SCC| × Σ drafts) per cyclic
 *     SCC. For tree-shaped barrel graphs (the common case) it
 *     collapses to O(E_re) total.
 *   * Per-edge lookup at finalize time: O(1).
 *   * `transitiveVia` preserves the exact file path chain for diagnostics
 *     and graph provenance. Building those arrays copies the inherited path,
 *     which is O(depth²) in a pathological single-name barrel chain; practical
 *     TypeScript barrel chains are shallow enough that we keep exact paths
 *     instead of capping or summarizing them.
 *   * Pathological deep chains that previously needed
 *     `MAX_REEXPORT_DEPTH=100` to bound stack growth now resolve
 *     in full and are bounded only by available memory — the
 *     iterative formulation has no call-stack ceiling.
 */
function buildReexportClosures(files, byFilePath, edgeIndex) {
    const closures = new Map();
    for (const file of files)
        closures.set(file.filePath, new Map());
    // ── Step 1: build the re-export sub-graph (only resolvable
    // reexport/wildcard targets contribute edges).
    const subGraph = new Map();
    for (const file of files) {
        const targets = new Set();
        const drafts = edgeIndex.get(file.filePath);
        if (drafts !== undefined) {
            for (const d of drafts) {
                if (d.source.kind !== 'reexport' && d.source.kind !== 'wildcard')
                    continue;
                if (d.targetFile === null)
                    continue;
                if (!byFilePath.has(d.targetFile))
                    continue;
                targets.add(d.targetFile);
            }
        }
        subGraph.set(file.filePath, targets);
    }
    // ── Step 2: SCC over the sub-graph. Reuses the same iterative Tarjan
    // implementation that drives the file-level finalize loop, so any
    // call-stack-safety guarantees there transfer here unchanged.
    const subSccs = tarjanSccs(subGraph);
    // ── Step 3: process SCCs in reverse-topological order. Acyclic
    // singletons settle in one pass; cyclic SCCs run a bounded fixpoint.
    for (const scc of subSccs) {
        if (!scc.isCycle) {
            const filePath = scc.files[0];
            if (filePath !== undefined) {
                populateFileClosure(filePath, byFilePath, edgeIndex, closures);
            }
            continue;
        }
        // Cap = |SCC| + 1. With first-wins precedence each name needs at
        // most |SCC| iterations to propagate fully around the cycle; the
        // extra iteration confirms no progress and breaks the loop.
        const cap = scc.files.length + 1;
        let progressed = true;
        let iter = 0;
        while (progressed && iter < cap) {
            progressed = false;
            iter++;
            for (const filePath of scc.files) {
                if (populateFileClosure(filePath, byFilePath, edgeIndex, closures)) {
                    progressed = true;
                }
            }
        }
    }
    return closures;
}
/**
 * Populate one file's re-export closure for one pass. Returns `true`
 * iff the closure grew (signalling fixpoint progress to the caller).
 *
 * Walks the file's drafts in declaration order, named re-exports first
 * (precedence), then wildcards. For each draft, attempts:
 *   1. **Direct hit** — name exists in the target file's `localDefs`.
 *   2. **Inherited** — name exists in the target file's already-populated
 *      closure (which encodes the target's own re-export chain).
 *
 * `closures.get(targetFile)` may itself still be empty for in-SCC
 * targets on the first iteration; the outer fixpoint loop handles
 * that by re-invoking this function.
 */
function populateFileClosure(filePath, byFilePath, edgeIndex, closures) {
    const myClosure = closures.get(filePath);
    if (myClosure === undefined)
        return false;
    const before = myClosure.size;
    const drafts = edgeIndex.get(filePath);
    if (drafts === undefined)
        return false;
    // Named re-exports — precedence over wildcards, declaration order
    // first-wins for duplicates of the same exported name.
    for (const draft of drafts) {
        if (draft.source.kind !== 'reexport')
            continue;
        const targetFile = draft.targetFile;
        if (targetFile === null)
            continue;
        const targetModule = byFilePath.get(targetFile);
        if (targetModule === undefined)
            continue;
        const localName = draft.source.localName;
        if (myClosure.has(localName))
            continue;
        const importedName = draft.source.importedName;
        const direct = findExportByName(targetModule.localDefs, importedName);
        if (direct !== undefined) {
            myClosure.set(localName, { def: direct, via: Object.freeze([targetFile]) });
            continue;
        }
        const inherited = closures.get(targetFile)?.get(importedName);
        if (inherited !== undefined) {
            myClosure.set(localName, {
                def: inherited.def,
                via: Object.freeze([targetFile, ...inherited.via]),
            });
        }
        // Else: target's closure is still empty (in-SCC, awaiting next
        // iteration). Outer loop will revisit.
    }
    // Wildcard re-exports — fan out the target's own surface (localDefs
    // + transitive closure). `myClosure.has(name)` checks below preserve
    // the named-precedence and first-wins semantics from above.
    for (const draft of drafts) {
        if (draft.source.kind !== 'wildcard')
            continue;
        const targetFile = draft.targetFile;
        if (targetFile === null)
            continue;
        const targetModule = byFilePath.get(targetFile);
        if (targetModule === undefined)
            continue;
        for (const def of targetModule.localDefs) {
            const name = deriveSimpleName(def);
            if (name === null || myClosure.has(name))
                continue;
            myClosure.set(name, { def, via: Object.freeze([targetFile]) });
        }
        const targetClosure = closures.get(targetFile);
        if (targetClosure !== undefined) {
            for (const [name, entry] of targetClosure) {
                if (myClosure.has(name))
                    continue;
                myClosure.set(name, {
                    def: entry.def,
                    via: Object.freeze([targetFile, ...entry.via]),
                });
            }
        }
    }
    return myClosure.size > before;
}
/**
 * O(1) lookup into a precomputed re-export closure. Replaces the legacy
 * recursive `followReexportChain` traversal with a single map indexing.
 */
function lookupReexportedName(closures, filePath, name) {
    const closure = closures.get(filePath);
    if (closure === undefined)
        return null;
    const entry = closure.get(name);
    if (entry === undefined)
        return null;
    return { def: entry.def, via: entry.via };
}
/**
 * The "simple" (unqualified) name of a def, for import-name matching.
 *
 * Canonical source: `def.qualifiedName` — the tail after the last `.` (or
 * the whole string if no dot). Defs without a qualifiedName can't be
 * resolved by name here and return `null`; callers treat that as "name
 * not exported" and either retry in a later fixpoint iteration or mark
 * the edge unresolved.
 */
function deriveSimpleName(def) {
    const q = def.qualifiedName;
    if (q === undefined || q.length === 0)
        return null;
    const dot = q.lastIndexOf('.');
    return dot === -1 ? q : q.slice(dot + 1);
}
function findExportByName(defs, name) {
    // GENERIC RULE (applies to every language using this finalize
    // algorithm): when MULTIPLE `SymbolDefinition`s share the same simple
    // name in `localDefs`, prefer callable / type-like defs over plain
    // value defs (`Variable`, `Property`, …). The CALLER side of an
    // import almost always wants the callable, not a value shadow that
    // happens to share the name — and without a deterministic
    // preference, capture order silently decides which def the import
    // binds to.
    //
    // The single-def case is unchanged: when only one def has the name,
    // it's returned regardless of its type (the `fallback` path below).
    //
    // TypeScript is the first known language where this matters in
    // practice: `const fn = () => {}` emits BOTH a `Function` def (from
    // `@declaration.function` on the inner arrow) AND a `Variable` def
    // (from the generic `@declaration.variable` pattern matching the
    // wrapping `lexical_declaration`), and consumers of `import { fn }`
    // need to bind to the callable. Other migrated languages don't
    // currently produce dual emits of this shape, so the rule is a no-op
    // for them today; future languages get the same correctness
    // guarantee for free if they ever do.
    //
    // See `gitnexus/test/integration/resolvers/typescript-hof-callbacks.test.ts`
    // for the cross-file regression this rule prevents.
    let fallback;
    for (const d of defs) {
        if (deriveSimpleName(d) !== name)
            continue;
        if (isCallableOrTypeLike(d.type))
            return d;
        if (fallback === undefined)
            fallback = d;
    }
    return fallback;
}
const CALLABLE_OR_TYPE_LIKE = new Set([
    'Function',
    'Method',
    'Constructor',
    'Class',
    'Interface',
    'Enum',
    'Struct',
    'Record',
    'Trait',
    'Namespace',
    'Module',
    'TypeAlias',
    'Type',
    'Typedef',
]);
function isCallableOrTypeLike(type) {
    return CALLABLE_OR_TYPE_LIKE.has(type);
}
function countEdgesWithin(edgeIndex, files) {
    let n = 0;
    for (const filePath of files) {
        const drafts = edgeIndex.get(filePath);
        if (drafts === undefined)
            continue;
        for (const d of drafts) {
            if (d.targetFile !== null && files.has(d.targetFile))
                n++;
        }
    }
    // Guarantee at least one pass even for a trivial SCC (ensures deterministic
    // fixpoint termination even when a single-file SCC has zero intra-SCC edges
    // but still needs one settle pass).
    return Math.max(n, 1);
}
// ─── Internal: wildcard expansion (phase 4) ────────────────────────────────
function expandWildcard(edge, byFilePath, hooks, workspace) {
    if (edge.targetModuleScope === undefined || edge.targetFile === null) {
        return [edge]; // unresolvable wildcard survives as a single unlinked edge
    }
    const target = byFilePath.get(edge.targetFile);
    if (target === undefined)
        return [edge];
    const names = hooks.expandsWildcardTo(edge.targetModuleScope, workspace);
    if (names.length === 0)
        return [];
    const expanded = [];
    for (const name of names) {
        const def = findExportByName(target.localDefs, name);
        if (def === undefined)
            continue;
        expanded.push({
            localName: name,
            targetFile: edge.targetFile,
            targetExportedName: name,
            kind: 'wildcard-expanded',
            targetModuleScope: edge.targetModuleScope,
            targetDefId: def.nodeId,
        });
    }
    return expanded;
}
// ─── Internal: bindings materialization (phase 5) ───────────────────────────
function materializeBindings(files, linkedByScope, hooks) {
    const out = new Map();
    // Build a `nodeId → SymbolDefinition` index once across all files
    // (O(N_files × D_defs)) so the per-edge lookup below is O(1) instead
    // of a full linear scan. At realistic TypeScript monorepo scale
    // (~5k files × ~50 defs × ~100k linked import edges) this is the
    // difference between ~25 s and a few ms inside finalize. The map
    // is local to this pass — no cross-pass state leaks.
    const defById = new Map();
    for (const f of files) {
        for (const d of f.localDefs)
            defById.set(d.nodeId, d);
    }
    for (const file of files) {
        const scopeBindings = new Map();
        // Start with local defs as `origin: 'local'` bindings.
        for (const def of file.localDefs) {
            const name = deriveSimpleName(def);
            if (name === null)
                continue;
            const incoming = [{ def, origin: 'local' }];
            const existing = scopeBindings.get(name) ?? [];
            scopeBindings.set(name, hooks.mergeBindings(existing, incoming, file.moduleScope));
        }
        // Layer in finalized imports.
        const imports = linkedByScope.get(file.moduleScope) ?? [];
        for (const edge of imports) {
            if (edge.targetDefId === undefined || edge.linkStatus === 'unresolved')
                continue;
            const def = defById.get(edge.targetDefId);
            if (def === undefined)
                continue;
            const origin = edge.kind === 'namespace'
                ? 'namespace'
                : edge.kind === 'wildcard-expanded'
                    ? 'wildcard'
                    : edge.kind === 'reexport'
                        ? 'reexport'
                        : 'import';
            const fallback = deriveSimpleName(def);
            const name = edge.localName.length > 0 ? edge.localName : fallback;
            if (name === null)
                continue;
            const incoming = [{ def, origin, via: edge }];
            const existing = scopeBindings.get(name) ?? [];
            scopeBindings.set(name, hooks.mergeBindings(existing, incoming, file.moduleScope));
        }
        // Freeze nested buckets for immutability.
        const frozen = new Map();
        for (const [name, refs] of scopeBindings) {
            frozen.set(name, Object.freeze(refs.slice()));
        }
        out.set(file.moduleScope, frozen);
    }
    return out;
}
// ─── Internal: Tarjan SCC ──────────────────────────────────────────────────
/**
 * Iterative Tarjan SCC. Returns SCCs in **reverse-topological** order
 * (leaves first — a property Tarjan gives for free, and the order
 * `finalize` wants so leaves are fully resolved before their dependents).
 */
function tarjanSccs(graph) {
    const index = new Map();
    const lowlink = new Map();
    const onStack = new Set();
    const stack = [];
    const sccs = [];
    let idx = 0;
    // Iterative DFS to avoid stack overflow on deep import chains.
    const allNodes = Array.from(graph.keys()).sort(); // deterministic order
    const iterStack = [];
    for (const root of allNodes) {
        if (index.has(root))
            continue;
        iterStack.push({
            node: root,
            children: (graph.get(root) ?? new Set()).values(),
            entered: false,
        });
        while (iterStack.length > 0) {
            const frame = iterStack[iterStack.length - 1];
            if (frame === undefined)
                break;
            if (!frame.entered) {
                frame.entered = true;
                index.set(frame.node, idx);
                lowlink.set(frame.node, idx);
                idx++;
                stack.push(frame.node);
                onStack.add(frame.node);
            }
            const nextChild = frame.children.next();
            if (nextChild.done) {
                // Post-visit: compute SCC membership if frame.node is a root.
                if (lowlink.get(frame.node) === index.get(frame.node)) {
                    const scc = [];
                    let selfInCycle = false;
                    while (true) {
                        const w = stack.pop();
                        if (w === undefined) {
                            throw new Error(`Invariant violated: Tarjan stack exhausted at ${frame.node}`);
                        }
                        onStack.delete(w);
                        scc.push(w);
                        // A single-file self-loop counts as a cycle.
                        if (w === frame.node) {
                            selfInCycle = (graph.get(w) ?? new Set()).has(w);
                            break;
                        }
                    }
                    const isCycle = scc.length > 1 || selfInCycle;
                    sccs.push({ files: Object.freeze(scc), isCycle });
                }
                iterStack.pop();
                // Propagate lowlink to parent.
                if (iterStack.length > 0) {
                    const parent = iterStack[iterStack.length - 1];
                    if (parent !== undefined) {
                        lowlink.set(parent.node, Math.min(requiredNumber(lowlink, parent.node, 'lowlink'), requiredNumber(lowlink, frame.node, 'lowlink')));
                    }
                }
                continue;
            }
            const child = nextChild.value;
            if (!index.has(child)) {
                iterStack.push({
                    node: child,
                    children: (graph.get(child) ?? new Set()).values(),
                    entered: false,
                });
            }
            else if (onStack.has(child)) {
                lowlink.set(frame.node, Math.min(requiredNumber(lowlink, frame.node, 'lowlink'), requiredNumber(index, child, 'index')));
            }
        }
    }
    return sccs;
}
function requiredNumber(map, key, label) {
    const value = map.get(key);
    if (value === undefined) {
        throw new Error(`Invariant violated: missing Tarjan ${label} for ${key}`);
    }
    return value;
}
//# sourceMappingURL=finalize-algorithm.js.map