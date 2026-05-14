import { createRepoResolver, requestedRepo } from '../middleware/repo-resolver.js';
import path from 'path';
import { withLbugDb, executeQuery } from '../../core/lbug/lbug-adapter.js';
import { streamGraphNdjson, ClientDisconnectedError, isIgnorableGraphQueryError, } from '../streaming.js';
import { NODE_TABLES } from '../../_shared/index.js';
const GRAPH_RELATIONSHIP_QUERY = `MATCH (a)-[r:CodeRelation]->(b) RETURN a.id AS sourceId, b.id AS targetId, ` +
    `r.type AS type, r.confidence AS confidence, r.reason AS reason, r.step AS step`;
const quoteNodeTable = (table) => `\`${table.replace(/`/g, '``')}\``;
const getNodeQuery = (table, includeContent) => {
    const tableLabel = quoteNodeTable(table);
    if (table === 'File') {
        return includeContent
            ? `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.content AS content`
            : `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath`;
    }
    if (table === 'Folder') {
        return `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath`;
    }
    if (table === 'Community') {
        return `MATCH (n:${tableLabel}) RETURN n.id AS id, n.label AS label, n.heuristicLabel AS heuristicLabel, n.cohesion AS cohesion, n.symbolCount AS symbolCount`;
    }
    if (table === 'Process') {
        return `MATCH (n:${tableLabel}) RETURN n.id AS id, n.label AS label, n.heuristicLabel AS heuristicLabel, n.processType AS processType, n.stepCount AS stepCount, n.communities AS communities, n.entryPointId AS entryPointId, n.terminalId AS terminalId`;
    }
    if (table === 'Route') {
        return `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.responseKeys AS responseKeys, n.errorKeys AS errorKeys, n.middleware AS middleware`;
    }
    if (table === 'Tool') {
        return `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.description AS description`;
    }
    return includeContent
        ? `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine, n.content AS content`
        : `MATCH (n:${tableLabel}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine`;
};
const mapGraphNodeRow = (table, row, includeContent) => ({
    id: row.id ?? row[0],
    label: table,
    properties: {
        name: row.name ?? row.label ?? row[1],
        filePath: row.filePath ?? row[2],
        startLine: row.startLine,
        endLine: row.endLine,
        content: includeContent ? row.content : undefined,
        responseKeys: row.responseKeys,
        errorKeys: row.errorKeys,
        middleware: row.middleware,
        heuristicLabel: row.heuristicLabel,
        cohesion: row.cohesion,
        symbolCount: row.symbolCount,
        description: row.description,
        processType: row.processType,
        stepCount: row.stepCount,
        communities: row.communities,
        entryPointId: row.entryPointId,
        terminalId: row.terminalId,
    },
});
const mapGraphRelationshipRow = (row) => ({
    id: `${row.sourceId}_${row.type}_${row.targetId}`,
    type: row.type,
    sourceId: row.sourceId,
    targetId: row.targetId,
    confidence: row.confidence,
    reason: row.reason,
    step: row.step,
});
const buildGraph = async (includeContent = false) => {
    const nodes = [];
    for (const table of NODE_TABLES) {
        try {
            const rows = await executeQuery(getNodeQuery(table, includeContent));
            for (const row of rows) {
                nodes.push(mapGraphNodeRow(table, row, includeContent));
            }
        }
        catch (err) {
            if (!isIgnorableGraphQueryError(err)) {
                throw err;
            }
        }
    }
    const relationships = [];
    const relRows = await executeQuery(GRAPH_RELATIONSHIP_QUERY);
    for (const row of relRows) {
        relationships.push(mapGraphRelationshipRow(row));
    }
    return { nodes, relationships };
};
export function mountGraph(router, deps) {
    const resolveRepo = createRepoResolver(deps.backend, deps.jobManager, deps.config.repoHoldTimeoutMs);
    router.get('/api/graph', async (req, res) => {
        try {
            const entry = await resolveRepo(requestedRepo(req));
            if (!entry) {
                res.status(404).json({ error: 'Repository not found' });
                return;
            }
            const lbugPath = path.join(entry.storagePath, 'lbug');
            const includeContent = req.query.includeContent === 'true';
            const stream = req.query.stream === 'true';
            if (stream) {
                const abortController = new AbortController();
                let responseFinished = false;
                const markFinished = () => {
                    responseFinished = true;
                };
                const abortStreaming = () => {
                    if (!responseFinished) {
                        abortController.abort();
                    }
                };
                res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.flushHeaders();
                req.once('aborted', abortStreaming);
                res.once('finish', markFinished);
                res.once('close', abortStreaming);
                try {
                    await withLbugDb(lbugPath, async () => streamGraphNdjson(res, includeContent, abortController.signal));
                    if (!abortController.signal.aborted && !res.writableEnded) {
                        res.end();
                    }
                }
                finally {
                    req.off('aborted', abortStreaming);
                    res.off('finish', markFinished);
                    res.off('close', abortStreaming);
                }
                return;
            }
            const graph = await withLbugDb(lbugPath, async () => buildGraph(includeContent));
            res.json(graph);
        }
        catch (err) {
            if (err instanceof ClientDisconnectedError) {
                return;
            }
            const message = err.message || 'Failed to build graph';
            if (res.headersSent) {
                try {
                    res.write(JSON.stringify({ type: 'error', error: message }) + '\n');
                }
                catch {
                    // Best-effort only after streaming has started.
                }
                res.end();
                return;
            }
            res.status(500).json({ error: message });
        }
    });
}
