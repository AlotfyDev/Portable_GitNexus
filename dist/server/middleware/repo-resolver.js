import { listRegisteredRepos } from '../../storage/repo-manager.js';
import { logger } from '../../core/logger.js';
import path from 'path';
export function createRepoResolver(backend, jobManager, holdTimeoutMs) {
    const HOLD_QUEUE_TIMEOUT_SECS = Math.ceil(holdTimeoutMs / 1000);
    const resolveRepo = async (repoName, isRetry = false, req) => {
        const repos = await listRegisteredRepos();
        let found = null;
        const normalizedName = repoName ? path.basename(repoName) : undefined;
        if (normalizedName) {
            found =
                repos.find((r) => r.name === normalizedName) ||
                    repos.find((r) => r.name.toLowerCase() === normalizedName.toLowerCase()) ||
                    null;
        }
        else if (repos.length > 0) {
            found = repos[0];
        }
        if (!found && normalizedName) {
            const lower = normalizedName.toLowerCase();
            let clientGone = false;
            req?.on('close', () => {
                clientGone = true;
            });
            for (const job of jobManager.listJobs()) {
                const isMatch = job.repoName?.toLowerCase() === lower ||
                    (job.repoUrl && path.basename(job.repoUrl).replace('.git', '').toLowerCase() === lower) ||
                    (job.repoPath && path.basename(job.repoPath).toLowerCase() === lower);
                if (isMatch && ['queued', 'cloning', 'analyzing'].includes(job.status)) {
                    if (process.env.DEBUG) {
                        logger.debug({
                            jobId: String(job.id).replace(/[\r\n]/g, ' '),
                            repoName: String(normalizedName).replace(/[\r\n]/g, ' '),
                        }, '[debug] resolveRepo waiting for active job');
                    }
                    for (let wait = 0; wait < HOLD_QUEUE_TIMEOUT_SECS; wait++) {
                        if (clientGone)
                            return null;
                        const currentJob = jobManager.getJob(job.id);
                        if (!currentJob || currentJob.status === 'failed')
                            break;
                        if (currentJob.status === 'complete') {
                            await backend.init();
                            const freshRepos = await listRegisteredRepos();
                            return freshRepos.find((r) => r.name === normalizedName) || null;
                        }
                        await new Promise((r) => setTimeout(r, 1000));
                    }
                    return { __timedOut: true, repoName: normalizedName };
                }
            }
        }
        if (!found && normalizedName && !isRetry) {
            if (process.env.DEBUG) {
                logger.debug({ repoName: String(normalizedName).replace(/[\r\n]/g, ' ') }, '[debug] resolveRepo 404, triggering deep init');
            }
            await backend.init();
            return await resolveRepo(normalizedName, true, req);
        }
        return found;
    };
    return resolveRepo;
}
export function createRepoLockManager(activeRepoPaths) {
    const acquireRepoLock = (repoPath) => {
        if (activeRepoPaths.has(repoPath)) {
            return `Another job is already active for this repository`;
        }
        activeRepoPaths.add(repoPath);
        return null;
    };
    const releaseRepoLock = (repoPath) => {
        activeRepoPaths.delete(repoPath);
    };
    return { acquireRepoLock, releaseRepoLock };
}
export const requestedRepo = (req) => {
    const fromQuery = typeof req.query.repo === 'string' ? req.query.repo : undefined;
    if (fromQuery)
        return fromQuery;
    if (req.body && typeof req.body === 'object' && typeof req.body.repo === 'string') {
        return req.body.repo;
    }
    return undefined;
};
