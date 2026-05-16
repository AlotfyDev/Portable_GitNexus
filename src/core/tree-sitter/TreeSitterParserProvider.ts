/**
 * TreeSitterParserProvider — concrete ParserProvider implementation.
 *
 * Wraps the existing tree-sitter (native + web-tree-sitter) setup from
 * parser-loader.ts and wasm-bridge.ts behind the ParserProvider interface.
 *
 * This is the default (and currently only) parser backend. Consumers
 * should depend on ParserProvider, not on this class directly.
 */

import { Parser, Language, Query as WtsQuery } from 'web-tree-sitter';
import { SupportedLanguages } from 'gitnexus-shared';
import type { ParserProvider } from './ParserProvider.js';
import type { ParseResult, ParserQuery, ASTNode } from './types.js';

import {
  isLanguageAvailable as checkLanguageAvailable,
  loadLanguage as ensureLanguageLoaded,
  getLanguageGrammar,
} from './parser-loader.js';

/**
 * Adapts a tree-sitter SyntaxNode to our ASTNode interface.
 * tree-sitter's node shape is structurally compatible with ASTNode,
 * so this is a zero-cost type assertion.
 */
function toASTNode(node: unknown): ASTNode {
  return node as ASTNode;
}

/**
 * Adapts a tree-sitter Tree.rootNode to a ParseResult.
 */
function toParseResult(tree: { rootNode: unknown }): ParseResult {
  return { rootNode: toASTNode(tree.rootNode), internal: tree };
}

export class TreeSitterParserProvider implements ParserProvider {
  readonly name = 'tree-sitter';

  private _sharedParser: Parser | null = null;
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return;
    const { initWasmRuntime } = await import('./wasm-bridge.js');
    await initWasmRuntime();
    this._initialized = true;
  }

  private async getParser(): Promise<Parser> {
    if (!this._sharedParser) {
      await this.init();
      this._sharedParser = new Parser();
    }
    return this._sharedParser;
  }

  isLanguageAvailable(language: SupportedLanguages, filePath?: string): boolean {
    return checkLanguageAvailable(language, filePath);
  }

  async loadLanguage(language: SupportedLanguages, filePath?: string): Promise<void> {
    await this.init();
    await ensureLanguageLoaded(language, filePath);
  }

  async parse(
    content: string,
    language?: SupportedLanguages,
    filePath?: string,
  ): Promise<ParseResult> {
    const parser = await this.getParser();
    if (language) {
      await this.loadLanguage(language, filePath);
    }
    const tree = parser.parse(content, undefined);
    return toParseResult(tree);
  }

  createQuery(language: SupportedLanguages, queryString: string, _filePath?: string): ParserQuery {
    const grammar = getLanguageGrammar(language, _filePath);
    const tsQuery = new WtsQuery(grammar as Language, queryString);
    return {
      matches(node: ASTNode, startPosition?: number, endPosition?: number) {
        return tsQuery.matches(node as any) as any;
      },
    };
  }
}
