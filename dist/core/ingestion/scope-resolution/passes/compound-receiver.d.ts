/**
 * Resolve a compound-receiver expression's TYPE — `user.address.save()`,
 * `svc.get_user().save()`, `c.greet().save()` — to the class def of
 * the value the receiver expression produces.
 *
 * Three shapes (parsed C-family-style):
 *   - bare identifier `name` — look up via typeBinding chain
 *   - dotted `obj.field[.field]…` — walk fields via class-scope typeBindings
 *   - call `expr.method()` — recurse into expr, find method's return-type
 *     typeBinding on its class, resolve to a class
 *
 * **Field-fallback heuristic** (Phase-9C "unified fixpoint"): when the
 * receiver class has no `methodName`, walk its fields and try the
 * lookup on each field's type. Useful for dynamically-typed languages
 * (Python). Strictly-typed languages should pass
 * `fieldFallbackOnMethodLookup: false` via `ScopeResolver`.
 *
 * Generic for any C-family language (`.` member access, `()` call
 * syntax). Languages with non-C-family syntax (Ruby blocks, COBOL)
 * either don't trigger the call branch or skip this pass entirely.
 */
import type { ScopeId, SymbolDefinition } from '../../../../_shared/index.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { WorkspaceResolutionIndex } from '../workspace-index.js';
interface ResolveCompoundReceiverOptions {
    /** When true (default), if method lookup fails on the receiver's
     *  class, walk its fields and try the lookup on each field's class.
     *  Phase-9C "unified fixpoint" — Python-shaped heuristic. */
    readonly fieldFallback?: boolean;
    /** Language-specific accessor unwrap — `data.Values` on a
     *  Dictionary<K,V>-typed receiver yields V (C#), etc. Returns the
     *  element type's simple name, or `undefined` to let the regular
     *  field-walk handle the access. */
    readonly unwrapCollectionAccessor?: (receiverType: string, accessor: string) => string | undefined;
    /** Walk up from the class scope to ancestor (Module) scopes when
     *  looking up a method's return-type typeBinding. Only enable for
     *  languages that hoist return-type bindings to Module scope (C#);
     *  otherwise we risk picking up unrelated module-level bindings. */
    readonly hoistTypeBindingsToModule?: boolean;
}
export declare function resolveCompoundReceiverClass(receiverText: string, inScope: ScopeId, scopes: ScopeResolutionIndexes, index: WorkspaceResolutionIndex, options?: ResolveCompoundReceiverOptions, depth?: number): SymbolDefinition | undefined;
export {};
