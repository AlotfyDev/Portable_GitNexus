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
import { SupportedLanguages } from '../../../../_shared/index.js';
import { resolveImportPath } from '../../import-resolvers/standard.js';
export function resolveTsImportTarget(parsedImport, workspaceIndex) {
    const ctx = narrowTsContext(workspaceIndex);
    if (ctx === null)
        return null;
    // Dynamic imports carry `targetRaw` only for diagnostics; when the
    // expression isn't a string literal we can't resolve a file.
    // A string-literal dynamic import (`import('./m')`) resolves like a
    // static import — fall through to the shared path resolver.
    if (parsedImport.kind === 'dynamic-unresolved' && parsedImport.targetRaw === null)
        return null;
    if (parsedImport.targetRaw === null || parsedImport.targetRaw === '')
        return null;
    return resolveTsTarget(parsedImport.targetRaw, ctx);
}
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
export function resolveTsTarget(targetRaw, ctx) {
    if (targetRaw === '')
        return null;
    const language = ctx.language ?? SupportedLanguages.TypeScript;
    const allFileList = ctx.allFileList ?? Array.from(ctx.allFilePaths);
    const normalizedFileList = ctx.normalizedFileList ?? allFileList.map((f) => f.toLowerCase());
    const resolveCache = ctx.resolveCache ?? new Map();
    return resolveImportPath(ctx.fromFile, targetRaw, ctx.allFilePaths, allFileList, normalizedFileList, resolveCache, language, ctx.tsconfigPaths ?? null);
}
function narrowTsContext(workspaceIndex) {
    const ctx = workspaceIndex;
    if (ctx === undefined ||
        typeof ctx.fromFile !== 'string' ||
        !(ctx.allFilePaths instanceof Set)) {
        return null;
    }
    return ctx;
}
