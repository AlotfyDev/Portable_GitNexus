/**
 * Parser-agnostic AST node and related types.
 *
 * This type is the abstraction boundary between the ingestion pipeline
 * and concrete parsers (tree-sitter native, web-tree-sitter, etc.).
 * All parser-specific types (Parser.SyntaxNode, web-tree-sitter nodes)
 * must be adapted to this interface before reaching business logic.
 */

export interface Position {
  row: number;
  column: number;
}

/**
 * Parser-agnostic AST node. Covers the commonly used subset of
 * tree-sitter's SyntaxNode — enough for all ingestion consumers.
 *
 * Parser-specific internals (e.g. numeric `.id`, byte offsets) are
 * optional; consumers that need them must check existence first.
 */
export interface ASTNode {
  readonly type: string;
  readonly text: string;
  readonly startPosition: Position;
  readonly endPosition: Position;
  readonly parent: ASTNode | null;
  readonly children: readonly ASTNode[];
  readonly childCount: number;
  readonly namedChildren: readonly ASTNode[];
  readonly namedChildCount: number;
  child(index: number): ASTNode | null;
  namedChild(index: number): ASTNode | null;
  childForFieldName?(fieldName: string): ASTNode | null;
  readonly firstNamedChild: ASTNode | null;
  // Navigation — tree-sitter compatible
  readonly previousSibling: ASTNode | null;
  readonly nextSibling: ASTNode | null;
  readonly previousNamedSibling: ASTNode | null;
  readonly nextNamedSibling: ASTNode | null;
  readonly firstChild: ASTNode | null;
  readonly lastNamedChild: ASTNode | null;

  // Node attributes
  readonly isNamed: boolean;

  // Utility — tree traversal
  descendantsOfType(type: string): ASTNode[];

  // Parser tree (optional, for cache dedup)
  readonly tree?: unknown;

  /** Parser-specific internal node ID (used for caching dedup) */
  readonly id?: number;
  /** Byte offset of the start of this node */
  readonly startIndex?: number;
  /** Byte offset of the end of this node */
  readonly endIndex?: number;
}

/**
 * Result of a parse operation.
 * Holds the root AST node; consumers navigate via its children.
 *
 * The `internal` field carries the parser-specific tree object
 * (e.g. tree-sitter's `Parser.Tree`) for consumers that need it
 * (ASTCache, buildTypeEnv, scope-resolution). Most consumers should
 * only access `rootNode`.
 */
export interface ParseResult {
  readonly rootNode: ASTNode;
  /** Parser-specific internal tree (e.g. tree-sitter Parser.Tree) */
  readonly internal?: unknown;
}

/**
 * A compiled query against a parser grammar.
 * Abstracts tree-sitter Query objects.
 */
export interface ParserQuery {
  matches(node: ASTNode, startPosition?: number, endPosition?: number): ParserQueryMatch[];
}

export interface ParserQueryMatch {
  readonly pattern: number;
  readonly captures: ParserQueryCapture[];
}

export interface ParserQueryCapture {
  readonly name: string;
  readonly node: ASTNode;
}


