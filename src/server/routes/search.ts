import { Router } from 'express';
import type { ServerDependencies } from '../types.js';
import { createRepoResolver, requestedRepo } from '../middleware/repo-resolver.js';
import path from 'path';
import { searchQuery } from '../../core/query/search.js';

export function mountSearch(router: Router, deps: ServerDependencies): void {
  const resolveRepo = createRepoResolver(deps.backend, deps.jobManager, deps.config.repoHoldTimeoutMs);

  router.post('/api/search', async (req, res) => {
    try {
      const query = (req.body.query ?? '').trim();
      if (!query) {
        res.status(400).json({ error: 'Missing "query" in request body' });
        return;
      }

      const entry = await resolveRepo(requestedRepo(req));
      if (!entry) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }
      const lbugPath = path.join(entry.storagePath, 'lbug');
      const parsedLimit = Number(req.body.limit ?? 10);
      const limit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(100, Math.trunc(parsedLimit)))
        : 10;
      const mode: string = req.body.mode ?? 'hybrid';
      const enrich: boolean = req.body.enrich !== false;

      const result = await searchQuery({ query, limit, mode, enrich, lbugPath });
      const response: any = { results: result.results ?? result };
      if (result.ftsAvailable === false) {
        response.warning =
          'FTS indexes missing — keyword search degraded. Run: gitnexus analyze --force to rebuild indexes.';
      }
      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Search failed' });
    }
  });
}
