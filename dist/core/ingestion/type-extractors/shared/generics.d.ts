import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { TypeArgPosition } from './types.js';
export declare const extractGenericTypeArgs: (typeNode: SyntaxNode, depth?: number) => string[];
export declare function extractElementTypeFromString(typeStr: string, pos?: TypeArgPosition): string | undefined;
