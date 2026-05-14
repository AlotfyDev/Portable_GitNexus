/**
 * Optional grammar availability check.
 *
 * tree-sitter-dart and tree-sitter-proto are optionalDependencies that
 * require a `node-gyp rebuild` at install time. The build can be skipped
 * via GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1 (postinstall scripts), or it can
 * silently soft-fail when the C++ toolchain is missing.
 *
 * Either path produces the same observable: the .node binding is absent
 * at runtime. This helper detects that condition and surfaces a single
 * stderr line per missing grammar so users learn why .dart/.proto support
 * is unavailable instead of silently getting a degraded index.
 */
export interface MissingGrammar {
    name: string;
    extensions: string[];
}
/**
 * Returns the list of optional grammars whose native binding cannot be
 * loaded. Actually `require()`s the package — `require.resolve` would
 * locate the entry path even when the `.node` binding is absent (the
 * `file:` package directory is installed regardless of postinstall
 * outcome), giving false negatives for the exact users we want to warn:
 * those who installed with `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1` or whose
 * native rebuild soft-failed for missing toolchain.
 *
 * Node's module cache memoizes `require()` for us — calling this multiple
 * times is cheap. The catch distinguishes "missing" (MODULE_NOT_FOUND or
 * the typical node-gyp-build "could not find any binding" pattern) from
 * "broken" (SyntaxError, EACCES, native crash). Broken bindings surface a
 * separate stderr line so users get an actionable message instead of a
 * misleading "reinstall" hint.
 */
export declare function detectMissingOptionalGrammars(): MissingGrammar[];
/**
 * Log a one-line stderr warning for each missing grammar. Safe to call
 * unconditionally — silent if all grammars are present.
 *
 * `relevantExtensions`, if provided, filters the warning to grammars whose
 * extensions appear in the set (e.g. an analyze run can pass the set of
 * extensions actually present in the target repo so users without any
 * .dart/.proto files don't see noise).
 */
export declare function warnMissingOptionalGrammars(opts?: {
    context?: string;
    relevantExtensions?: ReadonlySet<string>;
}): void;
