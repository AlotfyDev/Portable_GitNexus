import { createDatabaseProvider } from '../../config/database-config.js';
import { isWriteQuery } from './constants.js';
import type { StateManager } from './state-manager.js';
import type { RepoHandle } from './types.js';
import type { GraphRAGBackend, EnrichedSearchResult, GrepResult } from '../../llm/tools.js';
import { NODE_TABLES } from 'gitnexus-shared';

const db = createDatabaseProvider();

export function createReadOnlyBackend(handle: RepoHandle, ctx: StateManager): GraphRAGBackend {
  return {
    executeQuery: async (cypher: string): Promise<Record<string, unknown>[]> => {
      if (isWriteQuery(cypher)) {
        throw new Error('Write operations are not allowed via the RAG agent backend.');
      }
      try {
        return await db.executeQuery(handle.id, cypher);
      } catch (err: any) {
        throw new Error(`Cypher query failed: ${err.message}`);
      }
    },

    search: async (
      query: string,
      opts?: { limit?: number; mode?: 'hybrid' | 'semantic' | 'bm25'; enrich?: boolean },
    ): Promise<EnrichedSearchResult[]> => {
      const limit = opts?.limit ?? 10;
      const mode = opts?.mode ?? 'hybrid';
      const enrich = opts?.enrich ?? true;

      const { bm25Search, semanticSearch } = await import('./search.js');
      const { mergeWithRRF } = await import('../../search/hybrid-search.js');

      let results: EnrichedSearchResult[] = [];

      if (mode === 'bm25') {
        const bm25Result = await bm25Search(handle, query, limit);
        results = bm25Result.results.map((r: any) => ({
          nodeId: r.nodeId,
          name: r.name,
          label: r.type || 'File',
          filePath: r.filePath,
          startLine: r.startLine,
          endLine: r.endLine,
          sources: ['bm25'],
          score: r.bm25Score ?? 0,
        }));
      } else if (mode === 'semantic') {
        const semanticResult = await semanticSearch(ctx, handle, query, limit);
        results = semanticResult.map((r: any) => ({
          nodeId: r.nodeId,
          name: r.name,
          label: r.type || r.label || 'Unknown',
          filePath: r.filePath,
          startLine: r.startLine,
          endLine: r.endLine,
          sources: ['semantic'],
          score: r.distance !== undefined ? 1 - r.distance : 0,
        }));
      } else {
        const fetchLimit = Math.max(limit * 3, 30);
        const [bm25Result, semanticResult] = await Promise.all([
          bm25Search(handle, query, fetchLimit),
          semanticSearch(ctx, handle, query, fetchLimit),
        ]);

        const bm25Mapped = bm25Result.results.map((r: any) => ({
          filePath: r.filePath,
          score: r.bm25Score ?? 0,
          rank: 0,
        }));

        const semanticMapped = semanticResult.map((r: any) => ({
          nodeId: r.nodeId,
          name: r.name,
          label: r.type || r.label || 'Unknown',
          filePath: r.filePath,
          distance: r.distance ?? 0.5,
          startLine: r.startLine,
          endLine: r.endLine,
        }));

        const merged = mergeWithRRF(bm25Mapped, semanticMapped, limit);
        results = merged.map((r) => ({
          nodeId: r.nodeId,
          name: r.name,
          label: r.label,
          filePath: r.filePath,
          startLine: r.startLine,
          endLine: r.endLine,
          sources: r.sources,
          score: r.score,
          bm25Score: r.bm25Score,
          semanticScore: r.semanticScore,
        }));
      }

      if (!enrich) return results;

      const validLabel = (label: string): boolean =>
        (NODE_TABLES as readonly string[]).includes(label);

      const enriched = await Promise.all(
        results.slice(0, limit).map(async (r) => {
          const nodeId = r.nodeId || '';
          const nodeLabel = nodeId.split(':')[0];
          const enrichment: { connections?: any; cluster?: string; processes?: any[] } = {};

          if (!nodeId || !validLabel(nodeLabel)) return { ...r, ...enrichment };

          const [connRes, clusterRes, procRes] = await Promise.all([
            db.executeParameterized(
              handle.id,
              `MATCH (n:\`${nodeLabel}\` {id: $nid})
               OPTIONAL MATCH (n)-[r1:CodeRelation]->(dst)
               OPTIONAL MATCH (src)-[r2:CodeRelation]->(n)
               RETURN collect(DISTINCT {name: dst.name, type: r1.type, confidence: r1.confidence}) AS outgoing,
                      collect(DISTINCT {name: src.name, type: r2.type, confidence: r2.confidence}) AS incoming
               LIMIT 1`,
              { nid: nodeId },
            ).catch(() => []),
            db.executeParameterized(
              handle.id,
              `MATCH (n:\`${nodeLabel}\` {id: $nid})
               MATCH (n)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community)
               RETURN c.label AS label, c.description AS description LIMIT 1`,
              { nid: nodeId },
            ).catch(() => []),
            db.executeParameterized(
              handle.id,
              `MATCH (n:\`${nodeLabel}\` {id: $nid})
               MATCH (n)-[rel:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
               RETURN p.id AS id, p.label AS label, rel.step AS step, p.stepCount AS stepCount
               ORDER BY rel.step`,
              { nid: nodeId },
            ).catch(() => []),
          ]);

          if (connRes.length > 0) {
            const row = connRes[0];
            const outgoing = (Array.isArray(row) ? row[0] : row.outgoing || [])
              .filter((c: any) => c?.name)
              .slice(0, 5);
            const incoming = (Array.isArray(row) ? row[1] : row.incoming || [])
              .filter((c: any) => c?.name)
              .slice(0, 5);
            enrichment.connections = { outgoing, incoming };
          }

          if (clusterRes.length > 0) {
            const row = clusterRes[0];
            enrichment.cluster = Array.isArray(row) ? row[0] : row.label;
          }

          if (procRes.length > 0) {
            enrichment.processes = procRes
              .map((row: any) => ({
                id: Array.isArray(row) ? row[0] : row.id,
                label: Array.isArray(row) ? row[1] : row.label,
                step: Array.isArray(row) ? row[2] : row.step,
                stepCount: Array.isArray(row) ? row[3] : row.stepCount,
              }))
              .filter((p: any) => p.id && p.label);
          }

          return { ...r, ...enrichment };
        }),
      );

      return enriched;
    },

    grep: async (pattern: string, limit?: number): Promise<GrepResult[]> => {
      const { execFileSync } = await import('child_process');
      const maxResults = limit ?? 100;

      try {
        new RegExp(pattern);
      } catch {
        return [];
      }

      try {
        const output = execFileSync(
          'git',
          ['grep', '-n', '--no-color', pattern, '--', '.'],
          { cwd: handle.repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
        );
        const lines = output.trim().split('\n').filter(Boolean);
        return lines.slice(0, maxResults).map((line: string) => {
          const colonIdx = line.indexOf(':');
          const secondColon = line.indexOf(':', colonIdx + 1);
          if (colonIdx === -1) return { filePath: '', line: 0, text: line };
          const filePath = line.substring(0, colonIdx);
          const lineNum = parseInt(line.substring(colonIdx + 1, secondColon), 10) || 0;
          const text = line.substring(secondColon + 1);
          return { filePath, line: lineNum, text };
        });
      } catch {
        return [];
      }
    },

    readFile: async (filePath: string): Promise<string> => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.resolve(handle.repoPath, filePath);
      try {
        return await fs.readFile(fullPath, 'utf-8');
      } catch (err: any) {
        throw new Error(`File not found: ${filePath} (${err.message})`);
      }
    },
  };
}
