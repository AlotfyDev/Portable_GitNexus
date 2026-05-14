import { createRepoResolver, requestedRepo, createRepoLockManager } from '../middleware/repo-resolver.js';
import { createRouteLimiter } from '../validation.js';
import { listRegisteredRepos, loadMeta, getStoragePath } from '../../storage/repo-manager.js';
import { closeLbug } from '../../core/lbug/lbug-adapter.js';
import { getCloneDir } from '../git-clone.js';
import fs from 'fs/promises';
export function mountRepos(router, deps) {
    const resolveRepo = createRepoResolver(deps.backend, deps.jobManager, deps.config.repoHoldTimeoutMs);
    const { acquireRepoLock, releaseRepoLock } = createRepoLockManager(deps.activeRepoPaths);
    router.get('/api/repos', async (_req, res) => {
        try {
            const repos = await listRegisteredRepos();
            res.json(repos.map((r) => ({
                name: r.name,
                path: r.path,
                indexedAt: r.indexedAt,
                lastCommit: r.lastCommit,
                stats: r.stats,
            })));
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to list repos' });
        }
    });
    router.get('/api/repo', async (req, res) => {
        try {
            const entry = await resolveRepo(requestedRepo(req), false, req);
            if (!entry) {
                res.status(404).json({ error: 'Repository not found. Run: gitnexus analyze' });
                return;
            }
            if (entry.__timedOut) {
                res.status(503).json({
                    error: `Repository analysis for "${entry.repoName}" is taking longer than expected. Please try again in a moment.`,
                });
                return;
            }
            const meta = await loadMeta(entry.storagePath);
            res.json({
                name: entry.name,
                repoPath: entry.path,
                indexedAt: meta?.indexedAt ?? entry.indexedAt,
                stats: meta?.stats ?? entry.stats ?? {},
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to get repo info' });
        }
    });
    router.delete('/api/repo', createRouteLimiter(), async (req, res) => {
        try {
            const repoName = requestedRepo(req);
            if (!repoName) {
                res.status(400).json({ error: 'Missing repo name' });
                return;
            }
            const entry = await resolveRepo(repoName);
            if (!entry) {
                res.status(404).json({ error: 'Repository not found' });
                return;
            }
            const lockKey = getStoragePath(entry.path);
            const lockErr = acquireRepoLock(lockKey);
            if (lockErr) {
                res.status(409).json({ error: lockErr });
                return;
            }
            try {
                try {
                    await closeLbug();
                }
                catch { }
                const storagePath = getStoragePath(entry.path);
                await fs.rm(storagePath, { recursive: true, force: true }).catch(() => { });
                let cloneDir = null;
                try {
                    cloneDir = getCloneDir(entry.name);
                }
                catch {
                    /* repo name not eligible for a clone dir (local repo) */
                }
                if (cloneDir) {
                    try {
                        const stat = await fs.stat(cloneDir);
                        if (stat.isDirectory()) {
                            await fs.rm(cloneDir, { recursive: true, force: true });
                        }
                    }
                    catch {
                        /* clone dir may not exist */
                    }
                }
                const { unregisterRepo } = await import('../../storage/repo-manager.js');
                await unregisterRepo(entry.path);
                await deps.backend.init().catch(() => { });
                res.json({ deleted: entry.name });
            }
            finally {
                releaseRepoLock(lockKey);
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to delete repo' });
        }
    });
}
