/**
 * ParserProvider interface
 *
 * Abstract interface for source-code parsing, following the same
 * pattern as GraphDatabaseProvider (src/core/storage/) and
 * IVecDBProvider (src/core/vector-store/).
 *
 * Decouples ALL parsing consumers (ingestion pipeline, scope resolution,
 * group extractors) from the concrete parser backend (tree-sitter native,
 * web-tree-sitter, etc.). Every backend implements this contract.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { ParseResult, ParserQuery } from './types.js';

export interface ParserProvider {
  readonly name: string;

  // ── Lifecycle ────────────────────────────────────────────────────────

  /** Initialize the parser runtime (e.g. web-tree-sitter WASM runtime). */
  init(): Promise<void>;

  // ── Language Support ─────────────────────────────────────────────────

  /** Check if a grammar is available for the given language. */
  isLanguageAvailable(language: SupportedLanguages, filePath?: string): boolean;

  /**
   * Ensure the grammar is loaded and set on the shared parser.
   * After this call, createQuery() can use the loaded grammar.
   */
  loadLanguage(language: SupportedLanguages, filePath?: string): Promise<void>;

  // ── Parsing ──────────────────────────────────────────────────────────

  /**
   * Parse source code.
   * If language is provided, loads the grammar before parsing.
   */
  parse(content: string, language?: SupportedLanguages, filePath?: string): Promise<ParseResult>;

  // ── Queries ──────────────────────────────────────────────────────────

  /**
   * Create a compiled query from a query string for the given language.
   * The language must be loaded first (via loadLanguage or parse with language).
   */
  createQuery(language: SupportedLanguages, queryString: string, filePath?: string): ParserQuery;
}
