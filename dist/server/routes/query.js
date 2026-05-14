import { createRepoResolver, requestedRepo } from '../middleware/repo-resolver.js';
import path from 'path';
import { withLbugDb, executeQuery } from '../../core/lbug/lbug-adapter.js';
import { isWriteQuery } from '../../core/lbug/pool-adapter.js';
export function mountQuery(router, deps) {
    const resolveRepo = createRepoResolver(deps.backend, deps.jobManager, deps.config.repoHoldTimeoutMs);
    router.post('/api/query', async (req, res) => {
        try {
            const cypher = req.body.cypher;
            if (!cypher) {
                res.status(400).json({ error: 'Missing "cypher" in request body' });
                return;
            }
            if (isWriteQuery(cypher)) {
                res.status(403).json({ error: 'Write queries are not allowed via the HTTP API' });
                return;
            }
            const entry = await resolveRepo(requestedRepo(req));
            if (!entry) {
                res.status(404).json({ error: 'Repository not found' });
                return;
            }
            const lbugPath = path.join(entry.storagePath, 'lbug');
            const result = await withLbugDb(lbugPath, () => executeQuery(cypher));
            res.json({ result });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Query failed' });
        }
    });
}
