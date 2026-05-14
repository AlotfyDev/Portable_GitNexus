/**
 * Receiver-bound CALLS / ACCESSES emit pass — generic 7-case
 * dispatcher consuming `ScopeResolver` for the language-specific bits
 * (super recognizer, field-fallback toggle).
 *
 * **Contract Invariant I4 — case order is load-bearing.** The cases
 * are evaluated in this order; the FIRST that emits an edge wins:
 *
 *   1. **super branch** — `provider.isSuperReceiver(receiverName)` →
 *      MRO walk skipping self
 *   2. **Case 0 (compound)** — receiver has `.` or `(` → compound resolver
 *   3. **Case 1 (namespace)** — receiver in `namespaceTargets` → exported def
 *   4. **Case 2 (class-name / static receiver)** — receiver resolves to a
 *      class-like binding (Class/Interface/Struct/Record/Enum/Trait) → MRO
 *      walk on that class. Also handles static-style invocations
 *      (`ILogger.Warn(...)`) with kind-aware reason/confidence for
 *      read/write ACCESSES.
 *   5. **Case 3 (dotted typeBinding for namespace prefix)** —
 *      `typeRef.rawName` like `models.User`
 *   6. **Case 3b (chain-typebinding)** — `typeRef.rawName` has a dot
 *      but not a namespace prefix → compound resolver
 *   7. **Case 4 (simple typeBinding)** — `typeRef.rawName` has no dot →
 *      MRO walk + `findOwnedMember`
 *
 * Reordering or merging cases changes resolution semantics.
 *
 * **Contract Invariant I5 — pre-seeding `seen` is forbidden.** The
 * orchestrator runs this pass FIRST (before `emitReferencesViaLookup`)
 * and consumes the populated `handledSites` set. Pre-seeding `seen`
 * from the shared resolver's emissions (an old optimization) actively
 * suppresses correct emissions for sites the shared resolver also
 * resolved to a wrong target.
 */
import type { ParsedFile } from '../../../../_shared/index.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { SemanticModel } from '../../model/semantic-model.js';
import type { ScopeResolver } from '../contract/scope-resolver.js';
import type { GraphNodeLookup } from '../graph-bridge/node-lookup.js';
import type { WorkspaceResolutionIndex } from '../workspace-index.js';
/** Subset of `ScopeResolver` consumed by this pass. Accepting the
 *  subset rather than the full provider keeps tests and partial
 *  refactors lighter — callers only need to populate what we read. */
type ReceiverBoundProviderSubset = Pick<ScopeResolver, 'isSuperReceiver' | 'fieldFallbackOnMethodLookup' | 'collapseMemberCallsByCallerTarget' | 'unwrapCollectionAccessor' | 'hoistTypeBindingsToModule'>;
export declare function emitReceiverBoundCalls(graph: KnowledgeGraph, scopes: ScopeResolutionIndexes, parsedFiles: readonly ParsedFile[], nodeLookup: GraphNodeLookup, handledSites: Set<string>, provider: ReceiverBoundProviderSubset, index: WorkspaceResolutionIndex, model: SemanticModel): number;
export {};
