import { type SyntaxNode } from '../../utils/ast-helpers.js';
import type { NodeLabel } from '../../../../_shared/index.js';
import type { PatternOverrides } from '../types.js';
export declare const emptyFileScope: () => ReadonlyMap<string, string>;
export declare const findNarrowingBranchScope: (node: SyntaxNode) => SyntaxNode | undefined;
export declare const fastStripNullable: (typeName: string) => string | undefined;
export declare const lookupInEnv: (env: Map<string, Map<string, string>>, varName: string, callNode: SyntaxNode, patternOverrides?: PatternOverrides, enclosingFunctionFinder?: (n: SyntaxNode) => {
    funcName: string;
    label: NodeLabel;
} | null, extractFunctionNameHook?: (n: SyntaxNode) => {
    funcName: string | null;
    label: NodeLabel;
} | null) => string | undefined;
export declare const findEnclosingScopeKey: (node: SyntaxNode, enclosingFunctionFinder?: (n: SyntaxNode) => {
    funcName: string;
    label: NodeLabel;
} | null, extractFunctionNameHook?: (n: SyntaxNode) => {
    funcName: string | null;
    label: NodeLabel;
} | null) => string | undefined;
