/** Type labels treated as class-like method-dispatch receivers. */
export declare const CLASS_LIKE_TYPES: Set<string>;
/**
 * Type labels that can be the target of a constructor-shaped call when no
 * explicit Constructor symbol is indexed.
 */
export declare const INSTANTIABLE_CLASS_TYPES: Set<string>;
export declare const CONSTRUCTOR_TARGET_TYPES: Set<string>;
/** Stdlib methods that preserve the receiver's type identity. */
export declare const TYPE_PRESERVING_METHODS: Set<string>;
export declare const MAX_EXPORTS_PER_FILE = 500;
export declare const MAX_TYPE_NAME_LENGTH = 256;
/**
 * Kotlin often declares parameters with boxed names (`Int`, `Boolean`, …) while
 * literal inference yields JVM primitives (`int`, `boolean`).
 */
declare const KOTLIN_BOXED_TO_PRIMITIVE: Readonly<Record<string, string>>;
export { KOTLIN_BOXED_TO_PRIMITIVE };
/** Properties/methods to ignore when extracting consumer accessed keys. */
export declare const RESPONSE_ACCESS_BLOCKLIST: Set<string>;
