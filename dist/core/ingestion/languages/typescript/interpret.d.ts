/**
 * Capture-match → semantic-shape interpreters for TypeScript.
 *
 * Two pure functions, both consumed by the central scope extractor:
 *
 *   - `interpretTsImport`      → `ParsedImport`
 *   - `interpretTsTypeBinding` → `ParsedTypeBinding`  (wired in Unit 6)
 *
 * The import matches arrive pre-decomposed by `emitTsScopeCaptures`
 * (one imported name per match, with synthesized
 * `@import.kind/source/name/alias` markers — see `import-decomposer.ts`).
 * The type-binding matches arrive straight from the raw query captures —
 * each `@type-binding.*` anchor carries `@type-binding.name` +
 * `@type-binding.type`.
 */
import type { CaptureMatch, ParsedImport, ParsedTypeBinding } from '../../../../_shared/index.js';
export declare function interpretTsImport(captures: CaptureMatch): ParsedImport | null;
/**
 * Interpret a `@type-binding.*` capture-match into a `ParsedTypeBinding`.
 *
 * TypeScript-specific strips:
 *
 *   - Trailing `?` on optional parameters: `(u?: User)` → `User`
 *   - `Promise<User>` / `Array<User>` / `ReadonlyArray<User>` / `Readonly<User>`
 *     → `User`  (wrappers that are transparent to chain propagation)
 *   - Single-arg `List<User>` / `Iterable<User>` / `Iterator<User>` —
 *     mirrors Python/C#'s generic-collection strip for for-of loops
 *   - Trailing `[]` on array types: `User[]` → `User`
 *   - Nullable unions: `User | null` / `User | undefined` / `null | User`
 *     → `User`
 *   - Dotted qualifiers: `models.User` → `User`  (unless the suffix is
 *     a known collection accessor we'd want to preserve — none apply
 *     to TS today, since TS uses `.values()` / `.keys()` call syntax)
 */
export declare function interpretTsTypeBinding(captures: CaptureMatch): ParsedTypeBinding | null;
