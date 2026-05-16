import { Router } from 'express';
import type { ServerDependencies } from '../types.js';
import { createRepoResolver, requestedRepo, createRepoLockManager } from '../middleware/repo-resolver.js';
import { createRouteLimiter } from '../validation.js';
import { mountSSEProgress } from '../streaming.js';
import { createDatabaseProvider } from '../../core/config/database-config.js';
const db = createDatabaseProvider();

export function mountEmbedding(router: Router, deps: ServerDependencies): void {
  const resolveRepo = createRepoResolver(deps.backend, deps.jobManager, deps.config.repoHoldTimeoutMs);
  const { acquireRepoLock, releaseRepoLock } = createRepoLockManager(deps.activeRepoPaths);

  router.post('/api/embed', createRouteLimiter({ limit: 20 }), async (req, res) => {
    try {
      const entry = await resolveRepo(requestedRepo(req));
      if (!entry) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      const repoLockPath = entry.storagePath;
      const lockErr = acquireRepoLock(repoLockPath);
      if (lockErr) {
        res.status(409).json({ error: lockErr });
        return;
      }

      const job = deps.embedJobManager.createJob({ repoPath: entry.storagePath });
      deps.embedJobManager.updateJob(job.id, {
        repoName: entry.name,
        status: 'analyzing' as any,
        progress: { phase: 'analyzing', percent: 0, message: 'Starting embedding generation...' },
      });

      const EMBED_TIMEOUT_MS = 30 * 60 * 1000;
      const embedTimeout = setTimeout(() => {
        const current = deps.embedJobManager.getJob(job.id);
        if (current && current.status !== 'complete' && current.status !== 'failed') {
          releaseRepoLock(repoLockPath);
          deps.embedJobManager.updateJob(job.id, {
            status: 'failed',
            error: 'Embedding timed out (30 minute limit)',
          });
        }
      }, EMBED_TIMEOUT_MS);

      (async () => {
        try {
          const repoName = entry.name;
          const { runEmbeddingPipeline } =
            await import('../../core/embeddings/embedding-pipeline.js');
          const existingEmbeddings = await db.getCachedEmbeddingHashes(repoName);
          if (existingEmbeddings && existingEmbeddings.size > 0) {
            console.log(
              `[embed] ${existingEmbeddings.size} nodes already embedded — incremental run with content-hash comparison`,
            );
          }

          const wrappedQuery = async (cypher: string) => db.executeQuery(repoName, cypher);
          const wrappedBatch = async (cypher: string, paramsList: Array<Record<string, any>>) => {
            await db.executeBatch(repoName, cypher, paramsList);
          };

          await runEmbeddingPipeline(
            wrappedQuery,
            wrappedBatch,
            (p) => {
              deps.embedJobManager.updateJob(job.id, {
                progress: {
                  phase:
                    p.phase === 'ready' ? 'complete' : p.phase === 'error' ? 'failed' : p.phase,
                  percent: p.percent,
                  message:
                    p.phase === 'loading-model'
                      ? 'Loading embedding model...'
                      : p.phase === 'embedding'
                        ? `Embedding nodes (${p.percent}%)...`
                        : p.phase === 'indexing'
                          ? 'Creating vector index...'
                          : p.phase === 'ready'
                            ? 'Embeddings complete'
                            : `${p.phase} (${p.percent}%)`,
                },
              });
            },
            {},
            undefined,
            undefined,
            existingEmbeddings,
          );

          clearTimeout(embedTimeout);
          releaseRepoLock(repoLockPath);
          const current = deps.embedJobManager.getJob(job.id);
          if (!current || current.status !== 'failed') {
            deps.embedJobManager.updateJob(job.id, { status: 'complete' });
          }
        } catch (err: any) {
          clearTimeout(embedTimeout);
          releaseRepoLock(repoLockPath);
          const current = deps.embedJobManager.getJob(job.id);
          if (!current || current.status !== 'failed') {
            deps.embedJobManager.updateJob(job.id, {
              status: 'failed',
              error: err.message || 'Embedding generation failed',
            });
          }
        }
      })();

      res.status(202).json({ jobId: job.id, status: 'analyzing' });
    } catch (err: any) {
      if (err.message?.includes('already in progress')) {
        res.status(409).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message || 'Failed to start embedding generation' });
      }
    }
  });

  router.get('/api/embed/:jobId', (req, res) => {
    const job = deps.embedJobManager.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({
      id: job.id,
      status: job.status,
      repoName: job.repoName,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  });

  mountSSEProgress(router as any, '/api/embed/:jobId/progress', deps.embedJobManager);

  router.delete('/api/embed/:jobId', (req, res) => {
    const job = deps.embedJobManager.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (job.status === 'complete' || job.status === 'failed') {
      res.status(400).json({ error: `Job already ${job.status}` });
      return;
    }
    deps.embedJobManager.cancelJob(req.params.jobId, 'Cancelled by user');
    res.json({ id: job.id, status: 'failed', error: 'Cancelled by user' });
  });
}
