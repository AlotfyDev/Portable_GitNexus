/**
 * Decompose a TypeScript `import_statement` / re-export `export_statement` /
 * dynamic `call_expression(import)` into one `CaptureMatch` per imported
 * name.
 *
 * Why split here? The `LanguageProvider.interpretImport` contract is
 * one `ParsedImport` per call. Tree-sitter delivers
 *
 *   import D, { X as Y, type Z } from './m'
 *
 * as a single `import_statement` match, so without decomposition we'd
 * lose names. The synthesized markers (`@import.kind` / `@import.name`
 * / `@import.alias` / `@import.source`) carry everything
 * `interpretTsImport` needs to recover the `ParsedImport` shape —
 * see `interpret.ts`.
 *
 * Kinds we emit and how `interpret.ts` maps them to `ParsedImport`:
 *
 *   - `default`            : `import D from './m'`          → alias (importedName=default)
 *   - `named`              : `import { X } from './m'`      → named
 *   - `named-alias`        : `import { X as Y } from './m'` → alias
 *   - `namespace`          : `import * as N from './m'`     → namespace
 *   - `reexport`           : `export { X } from './m'`      → reexport
 *   - `reexport-alias`     : `export { X as Y } from './m'` → reexport (with alias)
 *   - `reexport-wildcard`  : `export * from './m'`          → wildcard
 *   - `reexport-namespace` : `export * as ns from './m'`    → namespace (local=ns,imported=source)
 *   - `dynamic`            : `import('./m')` / `import(x)`  → dynamic-resolved or dynamic-unresolved
 *
 * Type-only constructs (`import type { X }`, `import { type X }`,
 * `export type { X }`) emit the same kinds as runtime forms — at the
 * TypeScript scope-resolution layer, types and values share the same
 * lookup; runtime-emission is a downstream concern.
 *
 * Side-effect imports (`import './polyfill'`) produce a single match
 * with `kind: 'side-effect'`. The shared finalize algorithm resolves
 * the target file and emits a file-level IMPORTS edge, but
 * materializes no `BindingRef` (matching the legacy DAG, which counts
 * `import './polyfill'` as a module-reachability dependency only).
 */
import type { CaptureMatch } from '../../../../_shared/index.js';
import { type SyntaxNode } from '../../utils/ast-helpers.js';
/**
 * Decompose an import anchor. Handles three node types:
 *
 *   - `import_statement`             : all static import forms (incl. side-effect)
 *   - `export_statement` (w/ source) : re-exports
 *   - `call_expression` (import fn)  : dynamic `import()`
 */
export declare function splitImportStatement(stmtNode: SyntaxNode): CaptureMatch[];
