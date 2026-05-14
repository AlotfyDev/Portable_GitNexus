/**
 * C# same-namespace cross-file visibility.
 *
 * C# makes every type declared in `namespace X` visible to every other
 * file that also declares `namespace X`, without any explicit `using`
 * directive. Python has no equivalent — every cross-file reference
 * needs an explicit import — so this is a C#-specific pass.
 *
 * Without this: `Service.cs` (namespace `FieldTypes`) can't see
 * `User` declared in `Models.cs` (same namespace), so `user.Address`
 * field-chain resolution fails at `findClassBindingInScope('User')`
 * in the Service.cs scope chain.
 *
 * Implementation: after the finalize pass populates immutable
 * `indexes.bindings` (from explicit `using` directives), walk each
 * file's tree-sitter AST for `namespace_declaration` /
 * `file_scoped_namespace_declaration` and `using_directive` nodes.
 * The orchestrator hands us its `treeCache` so files already parsed
 * by `extractParsedFile` are re-used instead of re-parsed —
 * `ParsedFile`'s underlying tree is the single source of truth.
 * Group classes by namespace, and append cross-file sibling classes
 * into each Namespace scope's `bindingAugmentations` bucket with
 * `origin: 'namespace'`. Finalized bindings remain first in
 * `lookupBindingsAt`, and local lexical `Scope.bindings` remains the
 * first-tier shadowing channel.
 *
 * The tree-sitter walk is authoritative: it sees `global using static`,
 * aliased `using static X = Y.Z;`, attributed namespace declarations,
 * and preprocessor-guarded declarations correctly because the
 * tree-sitter grammar parses them as real nodes (not textual
 * coincidences).
 */
import type { ParsedFile } from '../../../../_shared/index.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
/** Content + (optional) pre-parsed tree-sitter trees keyed by filePath.
 *  The orchestrator builds `fileContents` from the pipeline's file list;
 *  `treeCache` is the same `scopeTreeCache` already populated by the
 *  parse phase, so cache hits avoid a second `parser.parse()`. */
export interface CsharpSiblingInputs {
    readonly fileContents: ReadonlyMap<string, string>;
    readonly treeCache?: {
        get(filePath: string): unknown;
    };
}
/**
 * Append cross-file sibling class defs to each Namespace scope's
 * `bindingAugmentations` bucket. Class-like defs (Class / Interface /
 * Struct / Record / Enum) are visible cross-file; method / field
 * members are not.
 */
export declare function populateCsharpNamespaceSiblings(parsedFiles: readonly ParsedFile[], indexes: ScopeResolutionIndexes, inputs: CsharpSiblingInputs): void;
