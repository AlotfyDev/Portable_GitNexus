/**
 * Deterministic Resolution Functions
 *
 * Pure functions that resolve methods across the inheritance hierarchy
 * using only the SemanticModel registries and HeritageMap — NO dependency
 * on resolution-context.ts (circular dependency risk).
 */
import type { SymbolDefinition } from '../../../_shared/index.js';
import type { SemanticModel } from './semantic-model.js';
import type { HeritageMap } from './heritage-map.js';
import type { MroStrategy } from '../../../_shared/index.js';
/**
 * Gather all ancestor IDs in BFS / topological order.
 * Returns the linearized list of ancestor IDs (excluding the class itself).
 *
 * Uses a head-pointer BFS (`queue[head++]`) instead of `Array.shift()` to
 * avoid O(n) per-dequeue re-indexing — matching `buildParentMapFromHeritage`.
 */
declare function gatherAncestors(classId: string, parentMap: Map<string, string[]>): string[];
/**
 * Compute C3 linearization for a class given a parentMap.
 * Returns an array of ancestor IDs in C3 order (excluding the class itself),
 * or null if linearization fails (inconsistent or cyclic hierarchy).
 *
 * Used internally by `lookupMethodByOwnerWithMRO` for the Python MRO
 * strategy and re-exported for mro-processor.ts (graph-level MRO emission).
 */
export declare function c3Linearize(classId: string, parentMap: Map<string, string[]>, cache: Map<string, string[] | null>, inProgress?: Set<string>): string[] | null;
export { gatherAncestors };
/**
 * DAG stage 5 helper: look up a method on an owner class via MRO walk.
 *
 * Low-level resolver; no dependency on SymbolTable, language registry, or
 * resolution-context (keeps model/ layer free of cross-layer imports).
 * All strategies respect `argCount` for overload narrowing.
 * `ancestryOverride` replaces the default walk; caller must compute it correctly.
 *
 * Strategy summary (full docs in gitnexus-shared/mro-strategy.ts):
 * - `first-wins` / `leftmost-base` / `implements-split`: BFS, first match wins.
 * - `c3`: C3-linearized order; falls back to BFS on cycle/inconsistency.
 * - `qualified-syntax`: returns undefined immediately (Rust requires explicit syntax).
 * - `ruby-mixin`: kind-aware walk — see inline comments below.
 *
 * Internal API: exported for call-processor resolvers and tests.
 * External callers should use resolveMemberCall instead.
 *
 * @see gitnexus-shared/mro-strategy.ts § 'ruby-mixin'
 * @see call-processor.ts § resolveMemberCall
 */
export declare const lookupMethodByOwnerWithMRO: (ownerNodeId: string, methodName: string, heritageMap: HeritageMap, model: SemanticModel, strategy: MroStrategy, argCount?: number, 
/**
 * Optional pre-computed ancestry list. When provided, overrides the default
 * per-strategy ancestry source. Primarily used by Ruby singleton dispatch:
 * the caller supplies `heritageMap.getSingletonAncestry(ownerNodeId)` as
 * node-id array so this walker resolves against `extend` providers only.
 *
 * For `ruby-mixin` strategy, passing an override switches the walker into
 * a no-prepend-no-direct linear scan (the caller has already decided the
 * order), which is the correct semantics for singleton dispatch.
 */
ancestryOverride?: readonly string[]) => SymbolDefinition | undefined;
