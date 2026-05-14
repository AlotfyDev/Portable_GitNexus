/**
 * Repository Manager — barrel
 *
 * Re-exports all symbols from the repo-manager/ sub-modules.
 * registerRepo stays here because it imports from ./git.js
 * (the only non-stdlib dependency in this module).
 */
import path from 'path';
import { getInferredRepoName, resolveRepoIdentityRoot } from './git.js';
export * from './repo-manager/types.js';
export * from './repo-manager/constants.js';
export * from './repo-manager/errors.js';
export * from './repo-manager/paths.js';
export * from './repo-manager/meta.js';
export * from './repo-manager/gitignore.js';
export * from './repo-manager/config.js';
export * from './repo-manager/finalization.js';
// Registry sub-module — explicit named exports (writeRegistry is internal)
export { readRegistry, unregisterRepo, assertSafeStoragePath, resolveRegistryEntry, listRegisteredRepos, findSiblingClones } from './repo-manager/registry/index.js';
import { canonicalizePath, getStoragePaths } from './repo-manager/paths.js';
import { readRegistry, writeRegistry } from './repo-manager/registry/index.js';
import { RegistryNameCollisionError } from './repo-manager/errors.js';
// ─── Internal helpers (registry.ts would need git.js) ────────────────────
/**
 * Returns true when a previously-registered entry's `name` differs from
 * both `path.basename(entry.path)` and the git-remote-derived name —
 * i.e. a user explicitly aliased it via `analyze --name <alias>` on a
 * prior run.
 */
const hasCustomAlias = (entry, inferredName) => {
    const resolved = path.resolve(entry.path);
    if (entry.name === path.basename(resolved))
        return false;
    if (entry.name === path.basename(resolveRepoIdentityRoot(resolved)))
        return false;
    if (inferredName && entry.name === inferredName)
        return false;
    return true;
};
// ─── registerRepo (needs git.js) ─────────────────────────────────────────
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
export const registerRepo = async (repoPath, meta, opts) => {
    const resolved = path.resolve(repoPath);
    const { storagePath } = getStoragePaths(resolved);
    const canonicalInput = canonicalizePath(repoPath);
    const entries = await readRegistry();
    const existingIdx = entries.findIndex((e) => {
        const a = canonicalizePath(e.path);
        const b = canonicalInput;
        return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
    });
    const existing = existingIdx >= 0 ? entries[existingIdx] : null;
    let name;
    let isPreservedAlias = false;
    if (opts?.name !== undefined) {
        name = opts.name;
    }
    else {
        const inferred = getInferredRepoName(resolved);
        if (existing && hasCustomAlias(existing, inferred)) {
            name = existing.name;
            isPreservedAlias = true;
        }
        else {
            name = inferred ?? path.basename(resolveRepoIdentityRoot(resolved));
        }
    }
    const explicitName = opts?.name !== undefined || isPreservedAlias;
    if (explicitName && !opts?.allowDuplicateName) {
        const collidingEntry = entries.find((e, i) => i !== existingIdx &&
            e.name.toLowerCase() === name.toLowerCase() &&
            canonicalizePath(e.path) !== canonicalInput);
        if (collidingEntry) {
            throw new RegistryNameCollisionError(name, collidingEntry.path, resolved);
        }
    }
    const entry = {
        name,
        path: resolved,
        storagePath,
        indexedAt: meta.indexedAt,
        lastCommit: meta.lastCommit,
        remoteUrl: meta.remoteUrl,
        stats: meta.stats,
    };
    if (existingIdx >= 0) {
        entries[existingIdx] = entry;
    }
    else {
        entries.push(entry);
    }
    await writeRegistry(entries);
    return name;
};
