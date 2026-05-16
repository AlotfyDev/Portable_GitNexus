import { DatabaseProviderRegistry } from '../storage/registry.js';
import { hybridSearch } from '../search/hybrid-search.js';
import { searchFTSFromLbug } from '../search/bm25-index.js';
import { NODE_TABLES } from 'gitnexus-shared';

const db = DatabaseProviderRegistry.getProvider('ladybug');

export interface SearchQueryParams {
  query: string;
  limit: number;
  mode: string;
  enrich: boolean;
  lbugPath: string;
}

export interface SearchQueryResult {
  results: any[];
  ftsAvailable?: boolean;
}

export async function searchQuery(params: SearchQueryParams): Promise<SearchQueryResult> {
  const { query, limit, mode, enrich, lbugPath } = params;
  const repo = lbugPath;

  const dbQuery = (cypher: string) => db.executeQuery(repo, cypher);

  return db.withLbugDb(repo, async () => {
    let searchResults: any[];
    let ftsAvailable: boolean | undefined;

    if (mode === 'semantic') {
      const { isEmbedderReady } = await import('../embeddings/embedder.js');
      if (!isEmbedderReady()) {
        return { results: [] as any[], ftsAvailable: undefined };
      }
      const { semanticSearch: semSearch } =
        await import('../embeddings/embedding-pipeline.js');
      searchResults = await semSearch(dbQuery, query, limit);
      searchResults = searchResults.map((r: any, i: number) => ({
        ...r,
        score: r.score ?? 1 - (r.distance ?? 0),
        rank: i + 1,
        sources: ['semantic'],
      }));
    } else if (mode === 'bm25') {
      const ftsResponse = await searchFTSFromLbug(query, limit);
      ftsAvailable = ftsResponse.ftsAvailable;
      searchResults = ftsResponse.results.map((r: any, i: number) => ({
        ...r,
        rank: i + 1,
        sources: ['bm25'],
      }));
    } else {
      const { isEmbedderReady } = await import('../embeddings/embedder.js');
      if (isEmbedderReady()) {
        const { semanticSearch: semSearch } =
          await import('../embeddings/embedding-pipeline.js');
        searchResults = await hybridSearch(query, limit, dbQuery, semSearch);
      } else {
        const ftsResponse = await searchFTSFromLbug(query, limit);
        ftsAvailable = ftsResponse.ftsAvailable;
        searchResults = ftsResponse.results;
      }
    }

    if (!enrich) return { results: searchResults, ftsAvailable };

    const validLabel = (label: string): boolean =>
      (NODE_TABLES as readonly string[]).includes(label);

    const enriched = await Promise.all(
      searchResults.slice(0, limit).map(async (r: any) => {
        const nodeId: string = r.nodeId || r.id || '';
        const nodeLabel = nodeId.split(':')[0];
        const enrichment: { connections?: any; cluster?: string; processes?: any[] } = {};

        if (!nodeId || !validLabel(nodeLabel)) return { ...r, ...enrichment };

        const [connRes, clusterRes, procRes] = await Promise.all([
          db.executePrepared(repo,
            `
                MATCH (n:${nodeLabel} {id: $nid})
                OPTIONAL MATCH (n)-[r1:CodeRelation]->(dst)
                OPTIONAL MATCH (src)-[r2:CodeRelation]->(n)
                RETURN
                  collect(DISTINCT {name: dst.name, type: r1.type, confidence: r1.confidence}) AS outgoing,
                  collect(DISTINCT {name: src.name, type: r2.type, confidence: r2.confidence}) AS incoming
                LIMIT 1
              `,
            { nid: nodeId },
          ).catch(() => []),
          db.executePrepared(repo,
            `
                MATCH (n:${nodeLabel} {id: $nid})
                MATCH (n)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community)
                RETURN c.label AS label, c.description AS description
                LIMIT 1
              `,
            { nid: nodeId },
          ).catch(() => []),
          db.executePrepared(repo,
            `
                MATCH (n:${nodeLabel} {id: $nid})
                MATCH (n)-[rel:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
                RETURN p.id AS id, p.label AS label, rel.step AS step, p.stepCount AS stepCount
                ORDER BY rel.step
              `,
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

    return { results: enriched, ftsAvailable };
  });
}
