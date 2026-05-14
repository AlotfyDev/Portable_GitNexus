export declare const isGitRepo: (repoPath: string) => boolean;
export declare const getCurrentCommit: (repoPath: string) => string;
/**
 * Get a stable canonical identifier for the repo's `origin` remote, if any.
 *
 * Used to fingerprint two on-disk clones as the same logical repository
 * (issue #XXX — silent graph drift across sibling clones). `path` alone
 * is unreliable: worktrees, "clean clone for indexing" hygiene, and
 * multi-agent workspaces routinely have the same repo at multiple
 * absolute paths. The remote URL is the only on-disk signal that
 * survives those conventions.
 *
 * Normalisation strategy:
 *   - Strip a trailing `.git` so `https://x/y` and `https://x/y.git` collapse.
 *   - Strip a trailing `/` for the same reason.
 *   - `git@github.com:foo/bar` and `https://github.com/foo/bar` are
 *     intentionally NOT collapsed — they are different remotes from
 *     git's perspective and we don't want to assert equivalence.
 *   - Lower-case the host portion so `GitHub.com` and `github.com`
 *     don't desync; preserves case in path because some hosts
 *     (Bitbucket Server) treat repo paths case-sensitively.
 *
 * Returns `undefined` when there is no origin remote, the directory
 * isn't a git repo, or git itself isn't available.
 */
export declare const getRemoteUrl: (repoPath: string) => string | undefined;
/**
 * Find the git repository root from any path inside the repo
 */
export declare const getGitRoot: (fromPath: string) => string | null;
/**
 * Get the *canonical* repository root, dereferencing git worktrees.
 *
 * Unlike `getGitRoot` (which uses `git rev-parse --show-toplevel` and
 * returns the WORKTREE's root when called inside a linked worktree),
 * this uses `git rev-parse --git-common-dir` — the shared `.git`
 * directory, identical for the main checkout and every linked
 * worktree — and returns its parent.
 *
 * Why it matters (#1259): when `gitnexus analyze` runs inside a
 * worktree (e.g. `/repo/wt-feature/`), deriving `repoName` from
 * `path.basename(getGitRoot(cwd))` registers the project under the
 * worktree's directory slug (`wt-feature`) instead of the canonical
 * repo's basename (`repo`). Each worktree then re-registers as a
 * "different" project, AGENTS.md is rewritten with the wrong MCP URI,
 * and Claude-Code-style worktree workflows silently accumulate
 * duplicate registry entries.
 *
 * Returns `null` when the path is not inside a git repository or
 * `git` is not available, so callers can chain safely:
 * `getCanonicalRepoRoot(p) ?? getGitRoot(p) ?? p`.
 *
 * `--path-format=absolute` is required because `--git-common-dir`
 * returns a path *relative to cwd* by default (e.g. `../.git` when
 * called from a worktree), which would resolve to the wrong absolute
 * path if the caller later resolved it from a different directory.
 */
export declare const getCanonicalRepoRoot: (fromPath: string) => string | null;
/**
 * Resolve `fromPath` to the directory whose basename should drive the
 * registry name (#1259) — the *identity root*. Three outcomes:
 *
 *   1. `fromPath` IS the canonical checkout root → returns it unchanged.
 *   2. `fromPath` is a linked-worktree root (has its own `.git` entry, but
 *      `git rev-parse --git-common-dir` points at a different `.git`) →
 *      returns the canonical repo root.
 *   3. `fromPath` is anything else — an arbitrary subdir under a git repo,
 *      a non-git folder, a `--skip-git` subdir of an unrelated parent
 *      checkout — returns `fromPath` unchanged.
 *
 * Why not just use `getCanonicalRepoRoot` directly? Because `git rev-parse
 * --git-common-dir` resolves the same canonical root for ANY path inside
 * a git repo, including unrelated subdirs. Using it for registry-name
 * derivation would silently re-key a `--skip-git` subdir analyze under
 * the parent git's basename, defeating the user's `--skip-git` intent
 * (regressing the #1232/#1233 fix). The "is this path a tree root"
 * gate confines the canonical-root collapse to exactly the cases where
 * #1259 matters: main checkouts and linked worktrees.
 */
export declare const resolveRepoIdentityRoot: (fromPath: string) => string;
/**
 * Find a git root by checking only `.git` entries on the ancestor chain.
 *
 * Unlike `getGitRoot`, this does not spawn `git`, so MCP can cheaply decide
 * whether a launch cwd is a worktree before running any subprocess there.
 */
export declare const findGitRootByDotGit: (fromPath: string) => string | null;
/**
 * Check whether a directory contains a .git entry (file or folder).
 *
 * This is intentionally a simple filesystem check rather than running
 * `git rev-parse`, so it works even when git is not installed or when
 * the directory is a git-worktree root (which has a .git file, not a
 * directory).  Use `isGitRepo` for a definitive git answer.
 *
 * @param dirPath - Absolute path to the directory to inspect.
 * @returns `true` when `.git` is present, `false` otherwise.
 */
export declare const hasGitDir: (dirPath: string) => boolean;
/**
 * Read `remote.origin.url` from a git repository, or `null` if not a
 * git repo, has no `origin` remote, or git is unavailable.
 *
 * Used by the registry-name inference path (#979) to recover a
 * meaningful repo name when `path.basename(repoPath)` is generic
 * (e.g. monorepo subprojects, git worktrees, Gas-Town-style
 * `<rig>/refinery/rig/` layouts).
 */
export declare const getRemoteOriginUrl: (repoPath: string) => string | null;
/**
 * Parse a repository name out of a git remote URL. Handles the common
 * SSH (`git@host:owner/repo.git`), HTTPS (`https://host/owner/repo.git`),
 * `git://`, `ssh://`, and `file://` shapes. Returns `null` for empty /
 * unparseable input.
 *
 * The heuristic: strip a trailing `.git` and trailing slashes, then
 * take the segment after the last `/` or `:`.
 */
export declare const parseRepoNameFromUrl: (url: string | null | undefined) => string | null;
/**
 * Convenience wrapper: derive a registry-friendly name from the repo's
 * `origin` remote, or `null` when it cannot be inferred.
 */
export declare const getInferredRepoName: (repoPath: string) => string | null;
export interface DiffHunk {
    startLine: number;
    endLine: number;
}
export interface FileDiff {
    filePath: string;
    hunks: DiffHunk[];
}
/**
 * Parse unified diff output (with -U0) into per-file hunk ranges.
 * Extracts the new-file line ranges from @@ hunk headers.
 */
export declare function parseDiffHunks(diffOutput: string): FileDiff[];
