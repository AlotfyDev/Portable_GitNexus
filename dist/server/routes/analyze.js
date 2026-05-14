import { createRouteLimiter } from '../validation.js';
import { mountSSEProgress } from '../streaming.js';
import { fork } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { getStoragePath } from '../../storage/repo-manager.js';
import { extractRepoName, getCloneDir, cloneOrPull } from '../git-clone.js';
import { getPortability } from '../../core/portability/index.js';
import { logger } from '../../core/logger.js';
import { createRepoLockManager } from '../middleware/repo-resolver.js';
import path from 'path';
export function mountAnalyze(router, deps) {
    const { acquireRepoLock, releaseRepoLock } = createRepoLockManager(deps.activeRepoPaths);
    router.post('/api/analyze', createRouteLimiter({ limit: 10 }), async (req, res) => {
        try {
            const { url: repoUrl, path: repoLocalPath, force, embeddings, dropEmbeddings } = req.body;
            if (repoUrl !== undefined && typeof repoUrl !== 'string') {
                res.status(400).json({ error: '"url" must be a string' });
                return;
            }
            if (repoLocalPath !== undefined && typeof repoLocalPath !== 'string') {
                res.status(400).json({ error: '"path" must be a string' });
                return;
            }
            if (!repoUrl && !repoLocalPath) {
                res.status(400).json({ error: 'Provide "url" (git URL) or "path" (local path)' });
                return;
            }
            if (repoLocalPath) {
                if (!path.isAbsolute(repoLocalPath)) {
                    res.status(400).json({ error: '"path" must be an absolute path' });
                    return;
                }
                if (path.normalize(repoLocalPath) !== path.resolve(repoLocalPath)) {
                    res.status(400).json({ error: '"path" must not contain traversal sequences' });
                    return;
                }
            }
            const job = deps.jobManager.createJob({ repoUrl, repoPath: repoLocalPath });
            if (job.status !== 'queued') {
                res.status(202).json({ jobId: job.id, status: job.status });
                return;
            }
            deps.jobManager.updateJob(job.id, { status: 'cloning' });
            (async () => {
                let targetPath = repoLocalPath;
                try {
                    if (repoUrl && !repoLocalPath) {
                        const repoName = extractRepoName(repoUrl);
                        targetPath = getCloneDir(repoName);
                        deps.jobManager.updateJob(job.id, {
                            status: 'cloning',
                            repoName,
                            progress: { phase: 'cloning', percent: 0, message: `Cloning ${repoUrl}...` },
                        });
                        await cloneOrPull(repoUrl, targetPath, (progress) => {
                            deps.jobManager.updateJob(job.id, {
                                progress: { phase: progress.phase, percent: 5, message: progress.message },
                            });
                        });
                    }
                    if (!targetPath) {
                        throw new Error('No target path resolved');
                    }
                    const analyzeLockKey = getStoragePath(targetPath);
                    const lockErr = acquireRepoLock(analyzeLockKey);
                    if (lockErr) {
                        deps.jobManager.updateJob(job.id, { status: 'failed', error: lockErr });
                        return;
                    }
                    deps.jobManager.updateJob(job.id, { repoPath: targetPath, status: 'analyzing' });
                    const MAX_WORKER_RETRIES = 2;
                    const isPortable = getPortability().isPortable;
                    const callerPath = isPortable ? '' : fileURLToPath(import.meta.url);
                    const isDev = !isPortable && callerPath.endsWith('.ts');
                    const workerFile = isDev ? 'analyze-worker.ts' : 'analyze-worker.js';
                    const workerPath = isPortable ? '' : path.join(path.dirname(callerPath), '..', workerFile);
                    const tsxHookArgs = isDev
                        ? ['--import', pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href]
                        : [];
                    const forkWorker = () => {
                        const currentJob = deps.jobManager.getJob(job.id);
                        if (!currentJob || currentJob.status === 'complete' || currentJob.status === 'failed')
                            return;
                        const child = fork(workerPath, [], {
                            execArgv: [...tsxHookArgs, '--max-old-space-size=8192'],
                            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                        });
                        let stderrChunks = '';
                        child.stderr?.on('data', (chunk) => {
                            stderrChunks += chunk.toString();
                            if (stderrChunks.length > 4096)
                                stderrChunks = stderrChunks.slice(-4096);
                        });
                        child.on('message', (msg) => {
                            if (msg.type === 'progress') {
                                deps.jobManager.updateJob(job.id, {
                                    status: 'analyzing',
                                    progress: { phase: msg.phase, percent: msg.percent, message: msg.message },
                                });
                            }
                            else if (msg.type === 'complete') {
                                releaseRepoLock(analyzeLockKey);
                                deps.backend
                                    .init()
                                    .then(() => {
                                    deps.jobManager.updateJob(job.id, {
                                        status: 'complete',
                                        repoName: msg.result.repoName,
                                    });
                                })
                                    .catch((err) => {
                                    logger.error({ err }, 'backend.init() failed after analyze:');
                                    deps.jobManager.updateJob(job.id, {
                                        status: 'failed',
                                        error: 'Server failed to reload after analysis. Try again.',
                                    });
                                });
                            }
                            else if (msg.type === 'error') {
                                releaseRepoLock(analyzeLockKey);
                                deps.jobManager.updateJob(job.id, {
                                    status: 'failed',
                                    error: msg.message,
                                });
                            }
                        });
                        child.on('error', (err) => {
                            releaseRepoLock(analyzeLockKey);
                            deps.jobManager.updateJob(job.id, {
                                status: 'failed',
                                error: `Worker process error: ${err.message}`,
                            });
                        });
                        child.on('exit', (code) => {
                            const j = deps.jobManager.getJob(job.id);
                            if (!j || j.status === 'complete' || j.status === 'failed')
                                return;
                            if (j.retryCount < MAX_WORKER_RETRIES) {
                                j.retryCount++;
                                const delay = 1000 * Math.pow(2, j.retryCount - 1);
                                const lastErr = stderrChunks.trim().split('\n').pop() || '';
                                logger.warn(`Analyze worker crashed (code ${code}), retry ${j.retryCount}/${MAX_WORKER_RETRIES} in ${delay}ms` +
                                    (lastErr ? `: ${lastErr}` : ''));
                                deps.jobManager.updateJob(job.id, {
                                    status: 'analyzing',
                                    progress: {
                                        phase: 'retrying',
                                        percent: j.progress.percent,
                                        message: `Worker crashed, retrying (${j.retryCount}/${MAX_WORKER_RETRIES})...`,
                                    },
                                });
                                stderrChunks = '';
                                setTimeout(forkWorker, delay);
                            }
                            else {
                                releaseRepoLock(analyzeLockKey);
                                deps.jobManager.updateJob(job.id, {
                                    status: 'failed',
                                    error: `Worker crashed ${MAX_WORKER_RETRIES + 1} times (code ${code})${stderrChunks ? ': ' + stderrChunks.trim().split('\n').pop() : ''}`,
                                });
                            }
                        });
                        deps.jobManager.registerChild(job.id, child);
                        child.send({
                            type: 'start',
                            repoPath: targetPath,
                            options: {
                                force: !!force,
                                embeddings: !!embeddings,
                                dropEmbeddings: !!dropEmbeddings,
                            },
                        });
                    };
                    forkWorker();
                }
                catch (err) {
                    if (targetPath)
                        releaseRepoLock(getStoragePath(targetPath));
                    deps.jobManager.updateJob(job.id, {
                        status: 'failed',
                        error: err.message || 'Analysis failed',
                    });
                }
            })();
            res.status(202).json({ jobId: job.id, status: job.status });
        }
        catch (err) {
            if (err.message?.includes('already in progress')) {
                res.status(409).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: err.message || 'Failed to start analysis' });
            }
        }
    });
    router.get('/api/analyze/:jobId', (req, res) => {
        const job = deps.jobManager.getJob(req.params.jobId);
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        res.json({
            id: job.id,
            status: job.status,
            repoUrl: job.repoUrl,
            repoPath: job.repoPath,
            repoName: job.repoName,
            progress: job.progress,
            error: job.error,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
        });
    });
    mountSSEProgress(router, '/api/analyze/:jobId/progress', deps.jobManager);
    router.delete('/api/analyze/:jobId', (req, res) => {
        const job = deps.jobManager.getJob(req.params.jobId);
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        if (job.status === 'complete' || job.status === 'failed') {
            res.status(400).json({ error: `Job already ${job.status}` });
            return;
        }
        deps.jobManager.cancelJob(req.params.jobId, 'Cancelled by user');
        res.json({ id: job.id, status: 'failed', error: 'Cancelled by user' });
    });
}
