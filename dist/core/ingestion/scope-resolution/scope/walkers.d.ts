/**
 * Scope-chain lookup primitives shared across language providers.
 *
 * Five functions:
 *   - `findReceiverTypeBinding` — walk scope.typeBindings up the chain
 *     for a receiver name.
 *   - `lookupBindingsAt` — read finalized + augmented binding refs at
 *     one scope, deduped by `def.nodeId`. The dual-source-aware
 *     primitive every other binding lookup composes with.
 *   - `findClassBindingInScope` — walk scope.bindings + the indexes via
 *     `lookupBindingsAt` for a class-kind binding.
 *   - `findOwnedMember` — find a method/field owned by a class def
 *     across all parsed files by (ownerId, simpleName).
 *   - `findExportedDef` — find a file-level exported def (top-of-module
 *     class / function) by simpleName.
 *
 * Next-consumer contract: every OO or module-capable language hits the
 * same pre-finalize / post-finalize binding split and the same
 * "resolve member on owner with MRO" pattern. All four are reusable
 * as-is for TypeScript, Java, Kotlin, Ruby, etc.
 */
import type { BindingRef, ParsedFile, ScopeId, SymbolDefinition, TypeRef } from '../../../../_shared/index.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { SemanticModel } from '../../model/semantic-model.js';
import type { WorkspaceResolutionIndex } from '../workspace-index.js';
/**
 * Look up binding refs at `scopeId` for `name`, consulting both the
 * finalize-owned `bindings` channel and the post-finalize
 * `bindingAugmentations` channel (see invariant I8 in
 * `contract/scope-resolver.ts`). Finalized refs come first; augmented
 * refs append, deduped by `def.nodeId` so a sibling that's also
 * explicitly imported doesn't double-emit.
 *
 * Returns a shared frozen empty array when neither channel has the
 * name — callers can compare against `=== EMPTY_BINDINGS` if they
 * want a fast-path miss check. The bucket arrays are returned by
 * reference when only one channel populates them; the merged path
 * allocates a fresh array.
 *
 * Walker primitives (`findClassBindingInScope`,
 * `findCallableBindingInScope`, `findExportedDefByName`) and
 * post-finalize passes that read finalized bindings (e.g.
 * `propagateImportedReturnTypes`, `namespace-targets`) MUST go
 * through this helper instead of `scopes.bindings.get(...)` directly,
 * so the augmentation channel is always visible.
 */
export declare function lookupBindingsAt(scopeId: ScopeId, name: string, scopes: ScopeResolutionIndexes): readonly BindingRef[];
/**
 * Return the union of bound names at `scopeId` across both the
 * finalized and augmented channels. Companion to `lookupBindingsAt`
 * for callers that need to iterate every name at a scope (e.g.
 * `propagateImportedReturnTypes`). Order is not guaranteed; callers
 * that need stable iteration should sort externally.
 *
 * Fast paths (zero allocation) when at most one channel is populated:
 * returns the underlying `Map.keys()` iterator directly. Only when both
 * channels carry names do we materialize a `Set` for deduplication.
 */
export declare function namesAtScope(scopeId: ScopeId, scopes: ScopeResolutionIndexes): Iterable<string>;
/**
 * True when a def's `type` names a class-like declaration — every kind
 * that collapses to `@scope.class` in the scope-extractor query contract.
 *
 * Semantics widened historically from `'Class' | 'Interface'` to cover
 * C#-shape languages (struct, record, enum, trait). Languages that emit
 * only `'Class'` are unaffected — the extra kinds never appear in their
 * parsed output.
 */
export declare function isClassLike(t: string): boolean;
/**
 * Walk the scope chain from `startScope` looking for a typeBinding
 * named `receiverName`. Returns the TypeRef or undefined if no binding
 * exists in the chain.
 */
export declare function findReceiverTypeBinding(startScope: ScopeId, receiverName: string, scopes: ScopeResolutionIndexes): TypeRef | undefined;
/**
 * Look up a class-like binding by name in the given scope's chain.
 *
 * "Class-like" covers `Class | Interface | Struct | Record | Enum |
 * Trait` via the shared `isClassLike` predicate — every kind that
 * collapses to `@scope.class` in the scope-extractor query contract.
 *
 * Walks the scope chain upward and consults TWO sources at each step:
 *   1. `scope.bindings` — populated during scope-extraction Pass 2 with
 *      local declarations (`origin: 'local'`).
 *   2. The cross-file finalized + augmented bindings, via
 *      `lookupBindingsAt` (per I8: finalized = canonical immutable
 *      output; augmented = post-finalize hooks like
 *      `populateNamespaceSiblings`).
 *
 * Without (2) we'd miss every cross-file class-receiver call.
 */
export declare function findClassBindingInScope(startScope: ScopeId, receiverName: string, scopes: ScopeResolutionIndexes): SymbolDefinition | undefined;
/**
 * Look up a callable (Function/Method/Constructor) by name in the
 * given scope's chain. Uses the dual-source pattern (scope.bindings +
 * `lookupBindingsAt` for finalized + augmented) so cross-file
 * imports are visible — without it free calls to imported functions
 * never resolve via the post-pass.
 *
 * Mirrors `findClassBindingInScope` exactly; only the accepted
 * def-type predicate differs.
 */
export declare function findCallableBindingInScope(startScope: ScopeId, callableName: string, scopes: ScopeResolutionIndexes): SymbolDefinition | undefined;
/**
 * Populate `ownerId` on every def structurally owned by a Class
 * scope — methods (defs in Function scopes whose parent is Class)
 * and class-body fields (defs directly in Class scopes).
 *
 * Generic OO ownership rule. Languages that want richer ownership
 * (e.g. inner-class qualification) can compose with this as a base
 * step.
 *
 * Mutates `parsed.localDefs` in place via type cast — `SymbolDefinition`
 * is `readonly` for consumers but the extractor returns plain objects.
 * Defs are shared by reference between `localDefs` and `Scope.ownedDefs`,
 * so this single mutation is visible from both sides.
 */
export declare function populateClassOwnedMembers(parsed: ParsedFile): void;
/**
 * Walk a scope chain upward looking for the innermost enclosing
 * Class scope and return that class's def. Used by per-language
 * `super` receiver branches to discover the dispatch base.
 */
export declare function findEnclosingClassDef(startScope: ScopeId, scopes: ScopeResolutionIndexes): SymbolDefinition | undefined;
/**
 * Find a free-function def by simple name across all parsed files,
 * preferring scope-chain-visible bindings (import + finalized scope
 * bindings) before falling back to a workspace-wide simple-name scan.
 *
 * The fallback scan is intentionally loose so per-language compound
 * resolvers can find a callable target even when the binding chain
 * doesn't surface it (e.g. cross-package re-exports the finalize
 * pass missed). Strictly-typed languages may want to disable the
 * fallback by simply not calling this helper from their compound
 * resolver.
 */
export declare function findExportedDefByName(name: string, inScope: ScopeId, scopes: ScopeResolutionIndexes, index: WorkspaceResolutionIndex): SymbolDefinition | undefined;
/**
 * Find a member of a class by simple name — delegates to
 * `SemanticModel.methods` (methods / functions / constructors) with a
 * fallback to `SemanticModel.fields` (properties / fields /
 * variables). After `runScopeResolution`'s reconciliation pass
 * populates both registries from `parsed.localDefs[i].ownerId`
 * (post-`populateOwners`), this is the single authoritative view of
 * class membership — no parallel scope-resolution index needed.
 *
 * Returns the first-seen overload for methods without arity or
 * return-type narrowing. Callers that need arity-aware dispatch use
 * `lookupMethodByOwner(owner, name, argCount)` directly.
 */
export declare function findOwnedMember(ownerDefId: string, memberName: string, model: SemanticModel): SymbolDefinition | undefined;
/**
 * Find a file-level def (top-of-module class / function / variable)
 * by simple name — consults the target file's Module scope's
 * finalized bindings. Only defs bound at module-scope with
 * `origin === 'local'` qualify, matching the historical
 * "module-export-visible" semantics. Class methods and class-body
 * fields bind at their containing class scope and are naturally
 * excluded.
 *
 * Reads from `WorkspaceResolutionIndex.moduleScopeByFile` (scope-tied
 * lookup that doesn't live on `SemanticModel`). This intentionally
 * does NOT call `lookupBindingsAt`: `findExportedDef` answers "what
 * did the target file declare locally at module scope?", while
 * `bindingAugmentations` models importer-side visibility created by
 * post-finalize hooks. Callers that need importer-visible exports use
 * `findExportedDefByName`, which is dual-channel aware.
 */
export declare function findExportedDef(targetFile: string, memberName: string, index: WorkspaceResolutionIndex): SymbolDefinition | undefined;
