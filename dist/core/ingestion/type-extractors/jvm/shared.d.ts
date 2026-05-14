import { type SyntaxNode } from '../../utils/ast-helpers.js';
import type { LiteralTypeInferrer } from '../types.js';
/** Walk up from a node to find an ancestor of a given type. */
export declare const findAncestorByType: (node: SyntaxNode, type: string) => SyntaxNode | undefined;
/** Infer the type of a literal AST node for Java/Kotlin overload disambiguation. */
export declare const inferJvmLiteralType: LiteralTypeInferrer;
