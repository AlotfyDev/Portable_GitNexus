/**
 * Repository Manager — barrel
 *
 * Re-exports all symbols from the repo-manager/ sub-modules.
 * registerRepo stays here because it imports from ./git.js
 * (the only non-stdlib dependency in this module).
 */
export * from './repo-manager/types.js';
export * from './repo-manager/constants.js';
export * from './repo-manager/errors.js';
export * from './repo-manager/paths.js';
export * from './repo-manager/meta.js';
export * from './repo-manager/gitignore.js';
export * from './repo-manager/config.js';
export * from './repo-manager/finalization.js';
export { readRegistry, unregisterRepo, assertSafeStoragePath, resolveRegistryEntry, listRegisteredRepos, findSiblingClones } from './repo-manager/registry/index.js';
import type { RepoMeta, RegisterRepoOptions } from './repo-manager/types.js';
/**
 * Register (add or update) a repo in the global registry.
 * Called after `gitnexus analyze` completes.
 *
 * Name resolution precedence (#829, #979):
 *   1. explicit `opts.name` (from `analyze --name <alias>`)
 *   2. preserved alias on an existing entry for this path
 *   3. `git config --get remote.origin.url` repo name
 *   4. `path.basename(repoPath)` (the original default)
 *
 * Returns the `name` that was actually written to the registry.
 */
export declare const registerRepo: (repoPath: string, meta: RepoMeta, opts?: RegisterRepoOptions) => Promise<string>;
