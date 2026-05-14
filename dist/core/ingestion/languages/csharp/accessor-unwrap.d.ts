/**
 * C# collection-accessor unwrapping.
 *
 * When the compound-receiver resolver encounters a trailing
 * `.Values` / `.Keys` on a dotted member-access chain, it calls the
 * provider's `unwrapCollectionAccessor` hook to find the element
 * type. This module supplies the C# implementation — recognizing
 * Dictionary-family generics and returning the value or key type.
 *
 * Other languages (Python, Java, TypeScript) use method-call syntax
 * for the same access (`.values()` / `.keys()`), which the compound-
 * receiver's call-expression branch already handles; they leave this
 * hook undefined.
 */
/**
 * Resolve `data.Values` / `data.Keys` on a Dictionary-like receiver
 * to its element-type simple name. Returns `undefined` for any
 * receiver / accessor combination we don't recognize, letting the
 * compound-receiver pass fall through to the regular field walk.
 */
export declare function unwrapCsharpCollectionAccessor(receiverType: string, accessor: string): string | undefined;
