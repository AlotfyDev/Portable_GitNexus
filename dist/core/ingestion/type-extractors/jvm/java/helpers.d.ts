import type { SyntaxNode } from '../../../utils/ast-helpers.js';
import { type TypeArgPosition } from '../../shared.js';
/** Extract element type from a Java type annotation AST node.
 *  Handles generic_type (List<User>), array_type (User[]). */
export declare const extractJavaElementTypeFromTypeNode: (typeNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined;
/** Walk up from a for-each to the enclosing method_declaration and search parameters. */
export declare const findJavaParamElementType: (iterableName: string, startNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined;
