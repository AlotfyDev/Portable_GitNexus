import type express from 'express';
import type { JobManager } from './analyze-job.js';
import { NODE_TABLES, type GraphNode, type GraphRelationship } from 'gitnexus-shared';
import { createDatabaseProvider } from '../core/config/database-config.js';
const db = createDatabaseProvider();

type GraphStreamRecord =
  | { type: 'node'; data: Record<string, unknown> }
  | { type: 'relationship'; data: Record<string, unknown> };

export class ClientDisconnectedError extends Error {
  constructor() {
    super('Client disconnected during graph stream');
    this.name = 'ClientDisconnectedError';
  }
}

export const isIgnorableGraphQueryError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('No table named')
  );
};

export function ensureStreamIsWritable(res: express.Response, signal?: AbortSignal): void {
  if (signal?.aborted || res.destroyed || res.writableEnded) {
    throw new ClientDisconnectedError();
  }
}

export async function waitForDrain(res: express.Response, signal?: AbortSignal): Promise<void> {
  ensureStreamIsWritable(res, signal);

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('close', onClose);
      signal?.removeEventListener('abort', onAbort);
    };

    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new ClientDisconnectedError());
    };
    const onAbort = () => {
      cleanup();
      reject(new ClientDisconnectedError());
    };

    res.once('drain', onDrain);
    res.once('close', onClose);
    signal?.addEventListener('abort', onAbort, { once: true });

    if (signal?.aborted || res.destroyed || res.writableEnded) {
      onAbort();
    }
  });

  ensureStreamIsWritable(res, signal);
}

export function isClientDisconnectWriteError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    (err as NodeJS.ErrnoException).code === 'ERR_STREAM_DESTROYED' ||
    (err as NodeJS.ErrnoException).code === 'EPIPE' ||
    (err as NodeJS.ErrnoException).code === 'ECONNRESET' ||
    err.message.includes('write after end')
  );
}

export async function writeNdjsonRecord(
  res: express.Response,
  record: GraphStreamRecord,
  signal?: AbortSignal,
): Promise<void> {
  ensureStreamIsWritable(res, signal);

  try {
    const canContinue = res.write(JSON.stringify(record) + '\n');
    if (!canContinue) {
      await waitForDrain(res, signal);
    }
  } catch (err) {
    if (isClientDisconnectWriteError(err)) {
      throw new ClientDisconnectedError();
    }
    throw err;
  }
}

const GRAPH_RELATIONSHIP_QUERY =
  `MATCH (a)-[r:CodeRelation]->(b) RETURN a.id AS sourceId, b.id AS targetId, ` +
  `r.type AS type, r.confidence AS confidence, r.reason AS reason, r.step AS step`;

function quoteNodeTable(table: string): string {
  return `\`${table.replace(/`/g, '``')}\``;
}

function getNodeQuery(table: string, includeContent: boolean): string {
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
}

function mapGraphNodeRow(table: string, row: any, includeContent: boolean): GraphNode {
  return {
    id: row.id ?? row[0],
    label: table as GraphNode['label'],
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
    } as GraphNode['properties'],
  };
}

function mapGraphRelationshipRow(row: any): GraphRelationship {
  return {
    id: `${row.sourceId}_${row.type}_${row.targetId}`,
    type: row.type,
    sourceId: row.sourceId,
    targetId: row.targetId,
    confidence: row.confidence,
    reason: row.reason,
    step: row.step,
  };
}

export async function streamGraphNdjson(
  repoName: string,
  res: express.Response,
  includeContent = false,
  signal?: AbortSignal,
): Promise<void> {
  for (const table of NODE_TABLES) {
    try {
      const rows = await db.executeQuery(repoName, getNodeQuery(table, includeContent));
      for (const row of rows) {
        await writeNdjsonRecord(
          res,
          {
            type: 'node',
            data: mapGraphNodeRow(table, row, includeContent) as unknown as Record<string, unknown>,
          },
          signal,
        );
      }
    } catch (err) {
      if (!isIgnorableGraphQueryError(err)) {
        throw err;
      }
    }
  }

  const rows = await db.executeQuery(repoName, GRAPH_RELATIONSHIP_QUERY);
  for (const row of rows) {
    await writeNdjsonRecord(
      res,
      {
        type: 'relationship',
        data: mapGraphRelationshipRow(row) as unknown as Record<string, unknown>,
      },
      signal,
    );
  }
}

export function mountSSEProgress(app: express.Express, routePath: string, jm: JobManager): void {
  app.get(routePath, (req, res) => {
    const job = jm.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    let eventId = 0;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    eventId++;
    res.write(`id: ${eventId}\ndata: ${JSON.stringify(job.progress)}\n\n`);

    if (job.status === 'complete' || job.status === 'failed') {
      eventId++;
      res.write(
        `id: ${eventId}\nevent: ${job.status}\ndata: ${JSON.stringify({
          repoName: job.repoName,
          error: job.error,
        })}\n\n`,
      );
      res.end();
      return;
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, 30_000);

    const unsubscribe = jm.onProgress(job.id, (progress) => {
      try {
        eventId++;
        if (progress.phase === 'complete' || progress.phase === 'failed') {
          const eventJob = jm.getJob(req.params.jobId);
          res.write(
            `id: ${eventId}\nevent: ${progress.phase}\ndata: ${JSON.stringify({
              repoName: eventJob?.repoName,
              error: eventJob?.error,
            })}\n\n`,
          );
          clearInterval(heartbeat);
          res.end();
          unsubscribe();
        } else {
          res.write(`id: ${eventId}\ndata: ${JSON.stringify(progress)}\n\n`);
        }
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
