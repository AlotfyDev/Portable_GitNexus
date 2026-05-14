import { CLASS_TYPES } from '../model/index.js';
/** Type labels treated as class-like method-dispatch receivers. */
export const CLASS_LIKE_TYPES = new Set([...CLASS_TYPES, 'Impl']);
/**
 * Type labels that can be the target of a constructor-shaped call when no
 * explicit Constructor symbol is indexed.
 */
export const INSTANTIABLE_CLASS_TYPES = new Set(['Class', 'Struct', 'Record']);
export const CONSTRUCTOR_TARGET_TYPES = new Set(['Constructor', 'Class', 'Struct', 'Record']);
/** Stdlib methods that preserve the receiver's type identity. */
export const TYPE_PRESERVING_METHODS = new Set([
    'unwrap',
    'expect',
    'unwrap_or',
    'unwrap_or_default',
    'unwrap_or_else',
    'clone',
    'to_owned',
    'as_ref',
    'as_mut',
    'borrow',
    'borrow_mut',
    'get',
    'orElseThrow',
]);
export const MAX_EXPORTS_PER_FILE = 500;
export const MAX_TYPE_NAME_LENGTH = 256;
/**
 * Kotlin often declares parameters with boxed names (`Int`, `Boolean`, …) while
 * literal inference yields JVM primitives (`int`, `boolean`).
 */
const KOTLIN_BOXED_TO_PRIMITIVE = {
    Int: 'int',
    Long: 'long',
    Short: 'short',
    Byte: 'byte',
    Float: 'float',
    Double: 'double',
    Boolean: 'boolean',
    Char: 'char',
};
export { KOTLIN_BOXED_TO_PRIMITIVE };
/** Properties/methods to ignore when extracting consumer accessed keys. */
export const RESPONSE_ACCESS_BLOCKLIST = new Set([
    'json', 'text', 'blob', 'arrayBuffer', 'formData',
    'ok', 'status', 'headers', 'clone',
    'then', 'catch', 'finally',
    'map', 'filter', 'forEach', 'reduce', 'find', 'some', 'every',
    'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'join',
    'sort', 'reverse', 'includes', 'indexOf',
    'length', 'toString', 'valueOf', 'keys', 'values', 'entries',
    'appendChild', 'removeChild', 'insertBefore', 'replaceChild', 'replaceChildren',
    'createElement', 'getElementById', 'querySelector', 'querySelectorAll',
    'setAttribute', 'getAttribute', 'removeAttribute', 'hasAttribute',
    'addEventListener', 'removeEventListener', 'dispatchEvent',
    'classList', 'className', 'parentNode', 'parentElement',
    'childNodes', 'children', 'nextSibling', 'previousSibling',
    'firstChild', 'lastChild', 'click', 'focus', 'blur',
    'submit', 'reset', 'innerHTML', 'outerHTML', 'textContent', 'innerText',
]);
