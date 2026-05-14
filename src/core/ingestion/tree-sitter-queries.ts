/*
 * Tree-sitter queries for extracting code definitions.
 *
 * Note: Different grammars (typescript vs tsx vs javascript) may have
 * slightly different node types. These queries are designed to be
 * compatible with the standard tree-sitter grammars.
 */

export { TYPESCRIPT_QUERIES, JAVASCRIPT_QUERIES } from './tree-sitter-queries/typescript.js';
export { PYTHON_QUERIES } from './tree-sitter-queries/python.js';
export { JAVA_QUERIES } from './tree-sitter-queries/java.js';
export { C_QUERIES, CPP_QUERIES } from './tree-sitter-queries/c-family.js';
export { GO_QUERIES } from './tree-sitter-queries/go.js';
export { CSHARP_QUERIES } from './tree-sitter-queries/csharp.js';
export { RUST_QUERIES } from './tree-sitter-queries/rust.js';
export { PHP_QUERIES } from './tree-sitter-queries/php.js';
export { RUBY_QUERIES } from './tree-sitter-queries/ruby.js';
export { KOTLIN_QUERIES } from './tree-sitter-queries/kotlin.js';
export { SWIFT_QUERIES } from './tree-sitter-queries/swift.js';
export { DART_QUERIES } from './tree-sitter-queries/dart.js';
export { LANGUAGE_QUERIES } from './tree-sitter-queries/index.js';
