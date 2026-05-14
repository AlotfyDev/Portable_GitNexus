/**
 * Trivial / no-op-ish hooks for the Python provider. Kept together
 * because each is a few lines and they share a common theme: they exist
 * to make the provider's choice explicit (rather than relying on
 * "absence == default") so reviewers don't have to re-derive the
 * analysis.
 */
import { findAncestorBeforeBoundary, FUNCTION_NODE_TYPES } from '../../utils/ast-helpers.js';
const PYTHON_METHOD_CONTAINER_TYPES = new Set(['class_definition']);
export function pythonFunctionDefinitionLabel(functionNode, defaultLabel) {
    if (defaultLabel !== 'Function')
        return defaultLabel;
    const ancestor = findAncestorBeforeBoundary(functionNode, PYTHON_METHOD_CONTAINER_TYPES, FUNCTION_NODE_TYPES);
    return ancestor === null ? 'Function' : 'Method';
}
// ─── bindingScopeFor ──────────────────────────────────────────────────────
/** Python has no block scope, so the central extractor's "innermost
 *  enclosing scope" default is already correct: `for x in …` creates
 *  `x` in the enclosing function/module scope (because we never emit a
 *  `@scope.block` for the for-loop body), comprehension variables stay
 *  in their expression context, etc. Returns `null` to delegate. */
export function pythonBindingScopeFor(_decl, _innermost, _tree) {
    return null;
}
// ─── importOwningScope ────────────────────────────────────────────────────
/** Function-local `from x import Y` should attach the binding to the
 *  function scope, not the module. Class-body imports (rare but legal —
 *  `class A: import x` makes `x` a class attribute) attach to the class.
 *  Module-level imports delegate to the central default. */
export function pythonImportOwningScope(_imp, innermost, _tree) {
    if (innermost.kind === 'Function' || innermost.kind === 'Class')
        return innermost.id;
    return null;
}
// ─── receiverBinding ──────────────────────────────────────────────────────
/** Look up `self` or `cls` in the function scope's type bindings.
 *  Returns `null` for free functions (no `self`/`cls`) and for
 *  non-Function scopes. */
export function pythonReceiverBinding(functionScope) {
    if (functionScope.kind !== 'Function')
        return null;
    return functionScope.typeBindings.get('self') ?? functionScope.typeBindings.get('cls') ?? null;
}
