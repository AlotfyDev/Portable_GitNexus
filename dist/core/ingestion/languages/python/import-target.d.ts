/**
 * Adapter from `(ParsedImport, WorkspaceIndex)` → concrete file path.
 *
 * Delegates to the existing `resolvePythonImportInternal` (PEP-328
 * relative resolution + standard suffix matching). The `WorkspaceIndex`
 * is opaque at this layer; consumers wire a `PythonResolveContext`
 * shape carrying `fromFile` + `allFilePaths`.
 *
 * Returning `null` lets the finalize algorithm mark the edge as
 * `linkStatus: 'unresolved'`.
 */
import type { ParsedImport, WorkspaceIndex } from '../../../../_shared/index.js';
export interface PythonResolveContext {
    readonly fromFile: string;
    /** Mutable `Set` because the legacy `resolvePythonImportInternal`
     *  chain downstream is typed to accept `Set<string>`. Callers that
     *  only hold a `ReadonlySet` should copy via `new Set(...)` at the
     *  adapter boundary. */
    readonly allFilePaths: Set<string>;
}
export declare function resolvePythonImportTarget(parsedImport: ParsedImport, workspaceIndex: WorkspaceIndex): string | null;
