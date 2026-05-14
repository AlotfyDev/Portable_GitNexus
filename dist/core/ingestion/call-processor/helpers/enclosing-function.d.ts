import type { SyntaxNode } from '../../utils/ast-helpers.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { LanguageProvider } from '../../language-provider.js';
/** Cache for method extraction results in findEnclosingFunction fallback path. */
export declare const enclosingFnExtractCache: Map<number, import("../../method-types.js").ExtractedMethods>;
/**
 * Walk up the AST from a node to find the enclosing function/method.
 * Returns null if the call is at module/file level (top-level code).
 */
export declare const findEnclosingFunction: (node: SyntaxNode, filePath: string, ctx: ResolutionContext, provider: LanguageProvider) => string | null;
