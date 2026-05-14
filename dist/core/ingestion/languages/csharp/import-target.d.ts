/**
 * Adapter from `(ParsedImport, WorkspaceIndex)` → concrete file path.
 *
 * Unit 2 shape: suffix-match against the repo's `.cs` files. Each
 * `using System.Collections.Generic;` could legally expand to multiple
 * files (every `.cs` that declares `namespace System.Collections.Generic`
 * — partial classes, assembly-wide namespaces). The scope-resolver
 * contract returns a single primary target, so we pick the first
 * match. Cross-file partial-class aggregation runs at graph-bridge
 * time (Unit 6) via `populateOwners`.
 *
 * The legacy csproj-based `resolveCSharpImportInternal` needs config
 * objects the scope-resolver doesn't carry; the Unit 7 parity gate
 * will surface cases where the suffix-match diverges from the
 * namespace-based resolver and we'll adjust the contract if needed.
 *
 * Returning `null` lets the finalize algorithm mark the edge as
 * `linkStatus: 'unresolved'`.
 */
import type { ParsedImport, WorkspaceIndex } from '../../../../_shared/index.js';
export interface CsharpResolveContext {
    readonly fromFile: string;
    readonly allFilePaths: ReadonlySet<string>;
}
export declare function resolveCsharpImportTarget(parsedImport: ParsedImport, workspaceIndex: WorkspaceIndex): string | null;
