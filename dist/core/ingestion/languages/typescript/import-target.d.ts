/**
 * Adapter from `(ParsedImport, WorkspaceIndex)` → concrete file path.
 *
 * Delegates to the existing standard-strategy resolver
 * (`resolveImportPath`) so tsconfig path aliases (`@/`, `~/`, …) and
 * suffix-based resolution follow the same rules as the legacy path.
 *
 * The `WorkspaceIndex` is opaque at the shared contract layer; we
 * narrow it to a TypeScript-shaped context that carries `fromFile` +
 * the full `allFilePaths` set + the optional `tsconfigPaths` the
 * resolver reads.
 *
 * Returning `null` lets the finalize algorithm mark the edge as
 * `linkStatus: 'unresolved'`.
 */
import type { ParsedImport, WorkspaceIndex } from '../../../../_shared/index.js';
import { SupportedLanguages } from '../../../../_shared/index.js';
import type { TsconfigPaths } from '../../language-config.js';
export interface TsResolveContext {
    readonly fromFile: string;
    /** Mutable `Set` because the standard resolver consumes `Set<string>`.
     *  Callers holding a `ReadonlySet` should copy via `new Set(...)`. */
    readonly allFilePaths: Set<string>;
    /** Repo file list, normalized (lowercased) for suffix matching. May
     *  be supplied by the orchestrator; if absent we derive it on the
     *  fly from `allFilePaths`. */
    readonly allFileList?: readonly string[];
    readonly normalizedFileList?: readonly string[];
    /** Per-call resolution cache to dedupe repeated lookups. */
    readonly resolveCache?: Map<string, string | null>;
    /** Parsed tsconfig path-aliases. `null` = no aliases configured. */
    readonly tsconfigPaths?: TsconfigPaths | null;
    /** JavaScript vs TypeScript switch — affects the extensions the
     *  resolver tries. Defaults to TypeScript. */
    readonly language?: SupportedLanguages.TypeScript | SupportedLanguages.JavaScript;
}
export declare function resolveTsImportTarget(parsedImport: ParsedImport, workspaceIndex: WorkspaceIndex): string | null;
/**
 * Resolve a raw module-path string to a workspace file path using the
 * same standard-strategy resolver as the legacy DAG. Operates directly on
 * the source string without requiring a `ParsedImport`, so the
 * `ScopeResolver.resolveImportTarget` adapter doesn't need to construct
 * a fake `ParsedImport` to reach the resolver.
 *
 * Returns `null` when:
 *   - the context is malformed (missing `fromFile` / `allFilePaths`)
 *   - `targetRaw` is empty
 *   - the resolver finds no matching file
 */
export declare function resolveTsTarget(targetRaw: string, ctx: TsResolveContext): string | null;
