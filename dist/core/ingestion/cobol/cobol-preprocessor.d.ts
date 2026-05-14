/**
 * COBOL source pre-processing and regex-based symbol extraction.
 *
 * DESIGN DECISION — Why regex instead of a full parser (ANTLR4, tree-sitter):
 *
 * 1. Performance: Regex processes ~1ms/file vs 50-200ms/file for ANTLR4/tree-sitter.
 *    On EPAGHE (14k COBOL files), this is ~14 seconds vs 12-47 minutes.
 *
 * 2. Reliability: tree-sitter-cobol@0.0.1's external scanner hangs indefinitely
 *    on ~5% of production files (no timeout possible). ANTLR4's proleap-cobol-parser
 *    is a Java project — using it from Node.js requires Java subprocesses or
 *    extracting .g4 grammars and generating JS/TS targets (significant effort).
 *
 * 3. Dialect compatibility: GnuCOBOL with Italian comments, patch markers in
 *    cols 1-6 (mzADD, estero, etc.), and vendor extensions. Formal grammars
 *    target COBOL-85 and would need dialect modifications.
 *
 * 4. Industry precedent: ctags, GitHub code navigation, and Sourcegraph all use
 *    regex-based extraction for code indexing. Full parsing is only needed for
 *    compilation or semantic analysis, not symbol extraction.
 *
 * 5. Determinism: Every regex pattern is tested with canonical COBOL input
 *    (see test/unit/cobol-preprocessor.test.ts). Same input always produces
 *    same output — no grammar ambiguity or parser state issues.
 *
 * This module provides:
 * 1. preprocessCobolSource() — cleans patch markers (kept for potential future use)
 * 2. extractCobolSymbolsWithRegex() — single-pass state machine COBOL extraction
 */
export type { CobolRegexResults } from './cobol-preprocessor/types.js';
export { preprocessCobolSource } from './cobol-preprocessor/preprocess.js';
export { extractCobolSymbolsWithRegex } from './cobol-preprocessor/extract.js';
export { RE_SET_TO_TRUE, RE_SET_INDEX } from './cobol-preprocessor/constants.js';
