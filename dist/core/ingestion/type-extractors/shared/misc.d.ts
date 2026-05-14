import type { SyntaxNode } from '../../utils/ast-helpers.js';
export declare const extractRubyConstructorAssignment: (node: SyntaxNode) => {
    varName: string;
    calleeName: string;
} | undefined;
export declare const hasTypeAnnotation: (node: SyntaxNode) => boolean;
export declare const unwrapAwait: (node: SyntaxNode | null) => SyntaxNode | null;
export declare const extractCalleeName: (callNode: SyntaxNode) => string | undefined;
