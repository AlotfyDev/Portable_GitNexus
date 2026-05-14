import { type SyntaxNode } from '../../../utils/ast-helpers.js';
import type { ClassNameLookup } from '../../types.js';
import { type TypeArgPosition } from '../../shared.js';
/** Find the constructor callee name in a Kotlin property_declaration's initializer. */
export declare const findKotlinConstructorCallee: (node: SyntaxNode, classNames: ClassNameLookup) => string | undefined;
/** Extract element type from a Kotlin type annotation AST node (user_type wrapping generic). */
export declare const extractKotlinElementTypeFromTypeNode: (typeNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined;
/** Walk up from a for-loop to the enclosing function_declaration and search parameters. */
export declare const findKotlinParamElementType: (iterableName: string, startNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined;
