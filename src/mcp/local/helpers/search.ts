import {
  executeQuery, executeParameterized,
} from '../../../core/lbug/pool-adapter.js';
import { collectBestChunks } from '../../../core/embeddings/types.js';
import {
  rankExactEmbeddingRows, type ExactEmbeddingRow,
} from '../../../core/embeddings/exact-search.js';
import { EMBEDDING_TABLE_NAME, EMBEDDING_INDEX_NAME } from '../../../core/lbug/schema.js';
import {
  getExactScanLimit, isVectorExtensionSupportedByPlatform,
} from '../../../core/platform/capabilities.js';
import { PhaseTimer } from '../../../core/search/phase-timer.js';
import { logger } from '../../../core/logger.js';
import { VALID_NODE_LABELS } from './constants.js';
import { logQueryError, logQueryTiming } from './logging.js';
import type { StateManager } from './state-manager.js';
import type { RepoHandle } from './types.js';

export async function bm25Search(
  repo: RepoHandle, query: string, limit: number,
): Promise<{ results: any[]; ftsUsed: boolean }> {
  const { searchFTSFromLbug } = await import('../../../core/search/bm25-index.js');
  let ftsResponse;
  try {
    ftsResponse = await searchFTSFromLbug(query, limit, repo.id);
  } catch (err: any) {
    logger.error({ err: err.message }, 'GitNexus: BM25/FTS search failed (FTS indexes may not exist) -');
    return { results: [], ftsUsed: false };
  }

  const bm25Results = ftsResponse.results;
  const ftsUsed = ftsResponse.ftsAvailable;
  const results: any[] = [];

  for (const bm25Result of bm25Results) {
    const fullPath = bm25Result.filePath;
    try {
      const nodeIds = bm25Result.nodeIds?.length ? bm25Result.nodeIds : null;
      const symbols = nodeIds
        ? await executeParameterized(
            repo.id,
            `MATCH (n) WHERE n.id IN $nodeIds
             RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, n.filePath AS filePath,
                    n.startLine AS startLine, n.endLine AS endLine`,
            { nodeIds },
          )
        : await executeParameterized(
            repo.id,
            `MATCH (n) WHERE n.filePath = $filePath
             RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, n.filePath AS filePath,
                    n.startLine AS startLine, n.endLine AS endLine LIMIT 3`,
            { filePath: fullPath },
          );

      if (symbols.length > 0) {
        for (const sym of symbols) {
          results.push({
            nodeId: sym.id || sym[0], name: sym.name || sym[1], type: sym.type || sym[2],
            filePath: sym.filePath || sym[3], startLine: sym.startLine || sym[4],
            endLine: sym.endLine || sym[5], bm25Score: bm25Result.score,
          });
        }
      } else {
        const fileName = fullPath.split('/').pop() || fullPath;
        results.push({ name: fileName, type: 'File', filePath: bm25Result.filePath, bm25Score: bm25Result.score });
      }
    } catch {
      const fileName = fullPath.split('/').pop() || fullPath;
      results.push({ name: fileName, type: 'File', filePath: bm25Result.filePath, bm25Score: bm25Result.score });
    }
  }

  return { results, ftsUsed };
}

export async function semanticSearch(
  ctx: StateManager, repo: RepoHandle, query: string, limit: number,
): Promise<any[]> {
  try {
    const tableCheck = await executeQuery(
      repo.id,
      `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN COUNT(*) AS cnt LIMIT 1`,
    );
    if (!tableCheck.length || (tableCheck[0].cnt ?? tableCheck[0][0]) === 0) return [];

    const { embedQuery, getEmbeddingDims } = await import('../../core/embedder.js');
    const queryVec = await embedQuery(query);
    const dims = getEmbeddingDims();
    const queryVecStr = `[${queryVec.join(',')}]`;

    let bestChunks = new Map<
      string, { distance: number; chunkIndex: number; startLine: number; endLine: number }
    >();

    if (isVectorExtensionSupportedByPlatform()) {
      try {
        bestChunks = await collectBestChunks(limit, async (fetchLimit) => {
          const vectorQuery = `
            CALL QUERY_VECTOR_INDEX('${EMBEDDING_TABLE_NAME}', '${EMBEDDING_INDEX_NAME}',
              CAST(${queryVecStr} AS FLOAT[${dims}]), ${fetchLimit})
            YIELD node AS emb, distance
            WITH emb, distance
            WHERE distance < 0.6
            RETURN emb.nodeId AS nodeId, emb.chunkIndex AS chunkIndex,
                   emb.startLine AS startLine, emb.endLine AS endLine, distance
            ORDER BY distance`;
          const embResults = await executeQuery(repo.id, vectorQuery);
          return embResults.map((row) => ({
            nodeId: row.nodeId ?? row[0], chunkIndex: row.chunkIndex ?? row[1] ?? 0,
            startLine: row.startLine ?? row[2] ?? 0, endLine: row.endLine ?? row[3] ?? 0,
            distance: row.distance ?? row[4],
          }));
        });
      } catch {
        bestChunks = new Map();
      }
    } else if (!ctx.warnedVectorUnsupported) {
      ctx.warnedVectorUnsupported = true;
      logger.warn(
        'GitNexus [query:vector]: VECTOR extension not supported on this platform; using exact scan fallback',
      );
    }

    if (bestChunks.size === 0) {
      const embeddingCount = Number(tableCheck[0].cnt ?? tableCheck[0][0] ?? 0);
      const exactLimit = getExactScanLimit();
      if (embeddingCount > exactLimit) return [];

      const rows = await executeQuery(
        repo.id,
        `MATCH (e:${EMBEDDING_TABLE_NAME})
         RETURN e.nodeId AS nodeId, e.chunkIndex AS chunkIndex,
                e.startLine AS startLine, e.endLine AS endLine, e.embedding AS embedding`,
      );
      const exactRows: ExactEmbeddingRow[] = rows.map((row) => ({
        nodeId: row.nodeId ?? row[0], chunkIndex: row.chunkIndex ?? row[1] ?? 0,
        startLine: row.startLine ?? row[2] ?? 0, endLine: row.endLine ?? row[3] ?? 0,
        embedding: row.embedding ?? row[4] ?? [],
      }));
      bestChunks = new Map(
        rankExactEmbeddingRows(exactRows, queryVec, limit, 0.6).map((row) => [
          row.nodeId,
          { distance: row.distance, chunkIndex: row.chunkIndex, startLine: row.startLine, endLine: row.endLine },
        ]),
      );
    }

    if (bestChunks.size === 0) return [];

    const results: any[] = [];
    for (const [nodeId, chunk] of Array.from(bestChunks.entries()).slice(0, limit)) {
      const labelEndIdx = nodeId.indexOf(':');
      const label = labelEndIdx > 0 ? nodeId.substring(0, labelEndIdx) : 'Unknown';
      if (!VALID_NODE_LABELS.has(label)) continue;

      try {
        const nodeQuery = label === 'File'
          ? `MATCH (n:File {id: $nodeId}) RETURN n.name AS name, n.filePath AS filePath`
          : `MATCH (n:\`${label}\` {id: $nodeId}) RETURN n.name AS name, n.filePath AS filePath`;
        const nodeRows = await executeParameterized(repo.id, nodeQuery, { nodeId });
        if (nodeRows.length > 0) {
          const nodeRow = nodeRows[0];
          results.push({
            nodeId, name: nodeRow.name ?? nodeRow[0] ?? '', type: label,
            filePath: nodeRow.filePath ?? nodeRow[1] ?? '', distance: chunk.distance,
            startLine: chunk.startLine, endLine: chunk.endLine,
          });
        }
      } catch { /* skip */ }
    }

    return results;
  } catch {
    return [];
  }
}

export async function executeQueryTool(
  ctx: StateManager, repo: RepoHandle, params: {
    query: string; task_context?: string; goal?: string; limit?: number;
    max_symbols?: number; include_content?: boolean;
  },
): Promise<any> {
  if (!params.query?.trim()) {
    return { error: 'query parameter is required and cannot be empty.' };
  }

  await ctx.ensureInitialized(repo.id);

  const processLimit = params.limit || 5;
  const maxSymbolsPerProcess = params.max_symbols || 10;
  const includeContent = params.include_content ?? false;
  const searchQuery = params.query.trim();

  const timer = new PhaseTimer();
  const wallStart = performance.now();

  const searchLimit = processLimit * maxSymbolsPerProcess;
  const [bm25SearchResult, semanticResults] = await Promise.all([
    timer.time('bm25', bm25Search(repo, searchQuery, searchLimit)),
    timer.time('vector', semanticSearch(ctx, repo, searchQuery, searchLimit)),
  ]);

  const bm25Results = bm25SearchResult.results;
  const ftsUsed = bm25SearchResult.ftsUsed;

  timer.start('merge');
  const scoreMap = new Map<string, { score: number; data: any }>();

  for (let i = 0; i < bm25Results.length; i++) {
    const result = bm25Results[i];
    const key = result.nodeId || result.filePath;
    const rrfScore = 1 / (60 + i);
    const existing = scoreMap.get(key);
    if (existing) existing.score += rrfScore;
    else scoreMap.set(key, { score: rrfScore, data: result });
  }

  for (let i = 0; i < semanticResults.length; i++) {
    const result = semanticResults[i];
    const key = result.nodeId || result.filePath;
    const rrfScore = 1 / (60 + i);
    const existing = scoreMap.get(key);
    if (existing) existing.score += rrfScore;
    else scoreMap.set(key, { score: rrfScore, data: result });
  }

  const merged = Array.from(scoreMap.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, searchLimit);
  timer.stop();

  timer.start('symbol_lookup');
  const processMap = new Map<string, {
    id: string; label: string; heuristicLabel: string; processType: string;
    stepCount: number; totalScore: number; cohesionBoost: number; symbols: any[];
  }>();
  const definitions: any[] = [];

  for (const [, item] of merged) {
    const sym = item.data;
    if (!sym.nodeId) {
      definitions.push({ name: sym.name, type: sym.type || 'File', filePath: sym.filePath });
      continue;
    }

    let processRows: any[] = [];
    try {
      processRows = await executeParameterized(
        repo.id,
        `MATCH (n {id: $nodeId})-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
         RETURN p.id AS pid, p.label AS label, p.heuristicLabel AS heuristicLabel,
                p.processType AS processType, p.stepCount AS stepCount, r.step AS step`,
        { nodeId: sym.nodeId },
      );
    } catch (e) { logQueryError('query:process-lookup', e); }

    let cohesion = 0;
    let module: string | undefined;
    try {
      const cohesionRows = await executeParameterized(
        repo.id,
        `MATCH (n {id: $nodeId})-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community)
         RETURN c.cohesion AS cohesion, c.heuristicLabel AS module LIMIT 1`,
        { nodeId: sym.nodeId },
      );
      if (cohesionRows.length > 0) {
        cohesion = (cohesionRows[0].cohesion ?? cohesionRows[0][0]) || 0;
        module = cohesionRows[0].module ?? cohesionRows[0][1];
      }
    } catch (e) { logQueryError('query:cluster-info', e); }

    let content: string | undefined;
    if (includeContent) {
      try {
        const contentRows = await executeParameterized(
          repo.id,
          `MATCH (n {id: $nodeId}) RETURN n.content AS content`,
          { nodeId: sym.nodeId },
        );
        if (contentRows.length > 0) content = contentRows[0].content ?? contentRows[0][0];
      } catch (e) { logQueryError('query:content-fetch', e); }
    }

    const symbolEntry = {
      id: sym.nodeId, name: sym.name, type: sym.type, filePath: sym.filePath,
      startLine: sym.startLine, endLine: sym.endLine,
      ...(module ? { module } : {}), ...(includeContent && content ? { content } : {}),
    };

    if (processRows.length === 0) {
      definitions.push(symbolEntry);
    } else {
      for (const row of processRows) {
        const pid = row.pid ?? row[0];
        const label = row.label ?? row[1];
        const hLabel = row.heuristicLabel ?? row[2];
        const pType = row.processType ?? row[3];
        const stepCount = row.stepCount ?? row[4];
        const step = row.step ?? row[5];

        if (!processMap.has(pid)) {
          processMap.set(pid, {
            id: pid, label, heuristicLabel: hLabel, processType: pType, stepCount,
            totalScore: 0, cohesionBoost: 0, symbols: [],
          });
        }
        const proc = processMap.get(pid)!;
        proc.totalScore += item.score;
        proc.cohesionBoost = Math.max(proc.cohesionBoost, cohesion);
        proc.symbols.push({ ...symbolEntry, process_id: pid, step_index: step });
      }
    }
  }
  timer.stop();

  timer.start('ranking');
  const rankedProcesses = Array.from(processMap.values())
    .map((p) => ({ ...p, priority: p.totalScore + p.cohesionBoost * 0.1 }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, processLimit);
  timer.stop();

  timer.start('formatting');
  const processes = rankedProcesses.map((p) => ({
    id: p.id, summary: p.heuristicLabel || p.label,
    priority: Math.round(p.priority * 1000) / 1000,
    symbol_count: p.symbols.length, process_type: p.processType, step_count: p.stepCount,
  }));

  const processSymbols = rankedProcesses.flatMap((p) =>
    p.symbols.slice(0, maxSymbolsPerProcess).map((s) => ({ ...s })),
  );

  const seen = new Set<string>();
  const dedupedSymbols = processSymbols.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  timer.stop();

  timer.mark('wall', performance.now() - wallStart);
  const timing = timer.summary();
  logQueryTiming(searchQuery, timing);

  return {
    processes, process_symbols: dedupedSymbols,
    definitions: definitions.slice(0, 20), timing,
    ...(!ftsUsed && {
      warning: 'FTS indexes missing — keyword search degraded. Run: gitnexus analyze --force to rebuild indexes.',
    }),
  };
}
