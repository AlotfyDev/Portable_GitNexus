/**
 * Tree-sitter module barrel.
 *
 * Exports the ParserProvider interface, the concrete TreeSitterParserProvider,
 * and parser-agnostic ASTNode types.
 *
 * Consumers should depend on ParserProvider and ASTNode — NOT on
 * tree-sitter or web-tree-sitter packages directly.
 */

export { TreeSitterParserProvider } from './TreeSitterParserProvider.js';
export { ParserProviderRegistry } from './ParserProviderRegistry.js';
export type { ParserProvider } from './ParserProvider.js';
export type {
  ASTNode,
  ParseResult,
  ParserQuery,
  ParserQueryMatch,
  ParserQueryCapture,
  Position,
} from './types.js';
