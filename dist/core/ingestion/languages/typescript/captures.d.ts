/**
 * `emitScopeCaptures` for TypeScript.
 *
 * Drives the TypeScript scope query against tree-sitter-typescript and groups
 * raw matches into `CaptureMatch[]` for the central extractor. Layers
 * synthesized streams on top:
 *
 *   1. **Import decomposition** — each `import_statement` / re-export is
 *      re-emitted with `@import.kind/source/name/alias/typeOnly` markers so
 *      `interpretTsImport` can recover the `ParsedImport` shape without
 *      re-parsing raw text (see `import-decomposer.ts`). Unit 2 adds this;
 *      until then, raw `@import.statement` matches flow through as-is.
 *   2. **Dynamic imports** — `import('./m')` is re-emitted as a
 *      decomposed `@import.statement` with `@import.kind=dynamic` so the
 *      central extractor treats it uniformly with static imports.
 *   3. **Function-decl arity metadata** (Unit 5) — `@declaration.parameter-count`
 *      / `@declaration.required-parameter-count` / `@declaration.parameter-types`
 *      synthesized onto function-like declarations so the registry can narrow
 *      overloads.
 *   4. **Callsite arity metadata** (Unit 5) — `@reference.arity` /
 *      `@reference.parameter-types` on every callsite.
 *   5. **Receiver-binding synthesis** (Unit 3) — `this` type anchors on
 *      instance methods, with arrow-function lexical-this walk-up.
 *
 * Pure given the input source text. No I/O, no globals consulted.
 */
import type { CaptureMatch } from '../../../../_shared/index.js';
export declare function emitTsScopeCaptures(sourceText: string, filePath: string, cachedTree?: unknown): readonly CaptureMatch[];
