import type { GraphDatabaseProvider } from './GraphDatabaseProvider.js';
import type {
  DBConfig,
  GraphNode,
  GraphData,
  GraphQuery,
  GraphInput,
  GraphRelationship,
  EmbeddingRecord,
  SearchResult,
  FTSResult,
} from './types.js';

import {
  initLbug as poolInitLbug,
  closeLbug as poolCloseLbug,
  isLbugReady as poolIsReady,
  executeQuery as poolExecuteQuery,
  executeParameterized as poolExecuteParameterized,
  touchRepo as poolTouchRepo,
} from '../lbug/pool-adapter.js';

import {
  initLbug as writeInitLbug,
  closeLbug as writeCloseLbug,
  safeClose,
} from '../lbug/lbug-adapter/connection.js';

import {
  executeWithReusedStatement,
} from '../lbug/lbug-adapter/query.js';

import { loadVectorExtension as loadLbugVectorExtension } from '../lbug/lbug-adapter.js';

import { loadGraphToLbug } from '../lbug/lbug-adapter/graph-loader.js';

import {
  loadFTSExtension,
  createFTSIndex,
  queryFTS as ftsQuery,
} from '../lbug/lbug-adapter/fts.js';

import {
  loadCachedEmbeddings,
  fetchExistingEmbeddingHashes,
  getEmbeddingTableName as getLbugEmbeddingTableName,
} from '../lbug/lbug-adapter/embeddings.js';

import { getLbugStats } from '../lbug/lbug-adapter/stats.js';

import { NODE_TABLES, EMBEDDING_TABLE_NAME, REL_TABLE_NAME } from '../lbug/schema.js';

const QUOTE_NODE_TABLE = (table: string): string => `\`${table.replace(/`/g, '``')}\``;

const BACKTICK_TABLES = new Set([
  'Struct', 'Enum', 'Macro', 'Typedef', 'Union', 'Namespace', 'Trait',
  'Impl', 'TypeAlias', 'Const', 'Static', 'Property', 'Record',
  'Delegate', 'Annotation', 'Constructor', 'Template', 'Module',
]);

const escapeTableName = (table: string): string =>
  BACKTICK_TABLES.has(table) ? `\`${table}\`` : table;

const FTS_INDEX_NAME = 'fts_idx';

const FTS_TABLE_CONFIGS: Array<{ table: string; properties: string[]; stemmer: string }> = [
  { table: 'File', properties: ['name', 'content'], stemmer: 'porter' },
  { table: 'Folder', properties: ['name'], stemmer: 'porter' },
  { table: 'Function', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Class', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Method', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Interface', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Section', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Variable', properties: ['name', 'content'], stemmer: 'porter' },
  { table: 'Enum', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Struct', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Macro', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Typedef', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Union', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Const', properties: ['name', 'content'], stemmer: 'porter' },
  { table: 'Static', properties: ['name', 'content'], stemmer: 'porter' },
  { table: 'Property', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Record', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Delegate', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Annotation', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Constructor', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Template', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Module', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Namespace', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Trait', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'TypeAlias', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'CodeElement', properties: ['name', 'content', 'description'], stemmer: 'porter' },
  { table: 'Route', properties: ['name', 'responseKeys', 'errorKeys', 'middleware'], stemmer: 'porter' },
  { table: 'Tool', properties: ['name', 'description'], stemmer: 'porter' },
];

export class LadybugGraphDatabaseProvider implements GraphDatabaseProvider {
  readonly name = 'ladybug';

  // Track per-repo dbPath so methods know where to initialize
  private repoDbPaths = new Map<string, string>();

  // ── Lifecycle ──────────────────────────────────────────────────────

  async initialize(repo: string, config?: DBConfig): Promise<void> {
    const dbPath = config?.connection;
    if (!dbPath) {
      throw new Error(
        `LadybugGraphDatabaseProvider.initialize requires a connection path in config for repo "${repo}"`,
      );
    }
    this.repoDbPaths.set(repo, dbPath);
    await poolInitLbug(repo, dbPath);
  }

  async close(repo: string): Promise<void> {
    this.repoDbPaths.delete(repo);
    await poolCloseLbug(repo);
  }

  async closeAll(): Promise<void> {
    this.repoDbPaths.clear();
    await poolCloseLbug();
  }

  isReady(repo: string): boolean {
    return poolIsReady(repo);
  }

  // ── Raw Cypher / Prepared Execution ───────────────────────────────

  async executeQuery(repo: string, cypher: string): Promise<any[]> {
    return poolExecuteQuery(repo, cypher);
  }

  async executeParameterized(
    repo: string,
    cypher: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    return poolExecuteParameterized(repo, cypher, params);
  }

  async executeBatch(
    repo: string,
    cypher: string,
    paramsList: Array<Record<string, any>>,
  ): Promise<void> {
    await executeWithReusedStatement(cypher, paramsList);
  }

  async executePrepared(
    repo: string,
    cypher: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    return poolExecuteParameterized(repo, cypher, params);
  }

  async withLbugDb<T>(repo: string, operation: () => Promise<T>): Promise<T> {
    if (!this.isReady(repo)) {
      throw new Error(
        `LadybugGraphDatabaseProvider.withLbugDb: repo "${repo}" is not initialized. Call initialize() first.`,
      );
    }
    return operation();
  }

  touchRepo(repo: string): void {
    poolTouchRepo(repo);
  }

  // ── Node Operations ───────────────────────────────────────────────

  async getNode(repo: string, id: string): Promise<GraphNode | null> {
    const allTables = NODE_TABLES as readonly string[];
    for (const table of allTables) {
      try {
        const tn = escapeTableName(table);
        const rows = await this.executeQuery(
          repo,
          `MATCH (n:${tn} {id: '${id.replace(/'/g, "''")}'}) RETURN n`,
        );
        if (rows.length > 0) {
          const node = rows[0].n ?? rows[0];
          return {
            id: node.id ?? node[0] ?? id,
            type: table,
            name: node.name ?? node[1] ?? '',
            filePath: node.filePath ?? node[2],
            content: node.content,
            startLine: node.startLine,
            endLine: node.endLine,
            description: node.description,
          };
        }
      } catch {
        // Table may not exist — try next
      }
    }
    return null;
  }

  async getNodes(repo: string, ids: string[]): Promise<GraphNode[]> {
    if (ids.length === 0) return [];
    const quoted = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
    const results: GraphNode[] = [];
    const allTables = NODE_TABLES as readonly string[];
    for (const table of allTables) {
      try {
        const tn = escapeTableName(table);
        const rows = await this.executeQuery(
          repo,
          `MATCH (n:${tn}) WHERE n.id IN [${quoted}] RETURN n`,
        );
        for (const row of rows) {
          const node = row.n ?? row;
          results.push({
            id: node.id ?? node[0],
            type: table,
            name: node.name ?? node[1] ?? '',
            filePath: node.filePath ?? node[2],
            content: node.content,
            startLine: node.startLine,
            endLine: node.endLine,
            description: node.description,
          });
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  async searchNodes(repo: string, query: string, limit = 20): Promise<GraphNode[]> {
    const escaped = query.replace(/'/g, "''");
    const results: GraphNode[] = [];
    const allTables = NODE_TABLES as readonly string[];
    for (const table of allTables) {
      if (results.length >= limit) break;
      try {
        const tn = escapeTableName(table);
        const rows = await this.executeQuery(
          repo,
          `MATCH (n:${tn}) WHERE n.name CONTAINS '${escaped}' RETURN n LIMIT ${limit}`,
        );
        for (const row of rows) {
          if (results.length >= limit) break;
          const node = row.n ?? row;
          results.push({
            id: node.id ?? node[0],
            type: table,
            name: node.name ?? node[1] ?? '',
            filePath: node.filePath ?? node[2],
          });
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  // ── Graph Operations ──────────────────────────────────────────────

  async getGraph(repo: string, options?: GraphQuery): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const allTables = NODE_TABLES as readonly string[];
    const labelFilter = options?.labels?.length ? new Set(options.labels) : null;
    const limit = options?.limit ?? 10_000;

    for (const table of allTables) {
      if (labelFilter && !labelFilter.has(table)) continue;
      try {
        const tn = escapeTableName(table);
        const rows = await this.executeQuery(
          repo,
          `MATCH (n:${tn}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine, n.content AS content LIMIT ${limit}`,
        );
        for (const row of rows) {
          nodes.push({
            id: row.id ?? row[0],
            type: table,
            name: row.name ?? row[1] ?? '',
            filePath: row.filePath ?? row[2],
          });
        }
      } catch {
        // skip
      }
    }

    let relationships: GraphRelationship[] = [];
    try {
      const relRows = await this.executeQuery(
        repo,
        `MATCH (a)-[r:${REL_TABLE_NAME}]->(b) RETURN a.id AS source, b.id AS target, r.type AS type, r.confidence AS confidence, r.reason AS reason, r.step AS step LIMIT ${limit}`,
      );
      relationships = relRows.map((row) => ({
        id: `${row.source ?? row[0]}_${row.type ?? row[2]}_${row.target ?? row[1]}`,
        source: row.source ?? row[0],
        target: row.target ?? row[1],
        type: row.type ?? row[2],
        confidence: row.confidence ?? row[3],
        reason: row.reason ?? row[4],
        step: row.step ?? row[5],
      }));
    } catch {
      // relationship table may not exist
    }

    return { nodes, relationships };
  }

  async getRelationships(repo: string, nodeId: string): Promise<GraphRelationship[]> {
    const escaped = nodeId.replace(/'/g, "''");
    try {
      const rows = await this.executeQuery(
        repo,
        `MATCH (a)-[r:${REL_TABLE_NAME}]->(b)
         WHERE a.id = '${escaped}' OR b.id = '${escaped}'
         RETURN a.id AS source, b.id AS target, r.type AS type,
                r.confidence AS confidence, r.reason AS reason, r.step AS step`,
      );
      return rows.map((row: any) => ({
        id: `${row.source ?? row[0]}_${row.type ?? row[2]}_${row.target ?? row[1]}`,
        source: row.source ?? row[0],
        target: row.target ?? row[1],
        type: row.type ?? row[2],
        confidence: row.confidence ?? row[3],
        reason: row.reason ?? row[4],
        step: row.step ?? row[5],
      }));
    } catch {
      return [];
    }
  }

  // ── Full-Text Search ──────────────────────────────────────────────

  async searchFTS(repo: string, query: string, limit = 20): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const ftsConfigs = FTS_TABLE_CONFIGS;

    for (const config of ftsConfigs) {
      if (results.length >= limit) break;
      try {
        const rows = await ftsQuery(
          config.table,
          FTS_INDEX_NAME,
          query,
          Math.ceil((limit - results.length) * 1.5),
          false,
        );
        for (const row of rows) {
          if (results.length >= limit) break;
          results.push({
            nodeId: row.nodeId,
            name: row.name,
            type: config.table,
            filePath: row.filePath,
            score: row.score,
          });
        }
      } catch {
        // index may not exist
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async createFTSIndexes(repo: string): Promise<void> {
    for (const config of FTS_TABLE_CONFIGS) {
      try {
        await createFTSIndex(config.table, FTS_INDEX_NAME, config.properties, config.stemmer);
      } catch {
        // best-effort — some tables may not exist
      }
    }
  }

  async queryFTS(repo: string, query: string): Promise<FTSResult[]> {
    const results: FTSResult[] = [];
    for (const config of FTS_TABLE_CONFIGS) {
      try {
        const rows = await ftsQuery(config.table, FTS_INDEX_NAME, query, 20, false);
        for (const row of rows) {
          results.push({
            nodeId: row.nodeId,
            name: row.name,
            filePath: row.filePath,
            score: row.score,
          });
        }
      } catch {
        // skip
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 50);
  }

  // ── Vector / Semantic Search ──────────────────────────────────────

  async searchVector(repo: string, query: string, limit = 10): Promise<SearchResult[]> {
    // Delegate to the dynamic import of the semantic search helper
    // which ultimately queries pool-adapter under the hood.
    const { executeQuery: eq } = await import('../lbug/pool-adapter.js');

    // Check if embeddings table exists and has data
    let count = 0;
    try {
      const cnt = await eq(
        repo,
        `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN COUNT(*) AS cnt LIMIT 1`,
      );
      if (cnt.length === 0) return [];
      const raw = cnt[0].cnt ?? cnt[0][0];
      count = Number(raw ?? 0);
    } catch {
      return [];
    }
    if (count === 0) return [];

    try {
      const { embedQuery, getEmbeddingDims } = await import('../../mcp/core/embedder.js');
      const queryVec = await embedQuery(query);
      const dims = getEmbeddingDims();
      const queryVecStr = `[${queryVec.join(',')}]`;

      const embResults = await eq(
        repo,
        `CALL QUERY_VECTOR_INDEX('${EMBEDDING_TABLE_NAME}', 'vector_idx',
          CAST(${queryVecStr} AS FLOAT[${dims}]), ${limit})
         YIELD node AS emb, distance
         WITH emb, distance
         RETURN emb.nodeId AS nodeId, emb.chunkIndex AS chunkIndex,
                emb.startLine AS startLine, emb.endLine AS endLine, distance
         ORDER BY distance LIMIT ${limit}`,
      ).catch(() => []);

      const results: SearchResult[] = [];
      for (const row of embResults) {
        const nodeId = row.nodeId ?? row[0];
        if (!nodeId) continue;
        const labelEnd = nodeId.indexOf(':');
        const label = labelEnd > 0 ? nodeId.substring(0, labelEnd) : 'Unknown';
        try {
          const nodeRows = await eq(
            repo,
            `MATCH (n) WHERE n.id = '${nodeId.replace(/'/g, "''")}' RETURN n.name AS name, n.filePath AS filePath LIMIT 1`,
          ).catch(() => []);
          const nodeRow = nodeRows[0] ?? {};
          results.push({
            nodeId,
            name: nodeRow.name ?? nodeRow[0] ?? '',
            type: label,
            filePath: nodeRow.filePath ?? nodeRow[1] ?? '',
            score: row.distance !== undefined ? 1 - row.distance : 0,
            startLine: row.startLine ?? row[2],
            endLine: row.endLine ?? row[3],
          });
        } catch {
          // skip
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  async searchHybrid(repo: string, query: string, limit = 10): Promise<SearchResult[]> {
    const fetchLimit = Math.max(limit * 3, 30);
    const [bm25Results, vectorResults] = await Promise.all([
      this.searchFTS(repo, query, fetchLimit),
      this.searchVector(repo, query, fetchLimit),
    ]);

    const { mergeWithRRF } = await import('../search/hybrid-search.js');
    const bm25Mapped = bm25Results.map((r) => ({
      filePath: r.filePath,
      score: r.score,
      rank: 0,
      nodeIds: r.nodeId ? [r.nodeId] : undefined,
    }));
    const semanticMapped = vectorResults.map((r) => ({
      nodeId: r.nodeId,
      name: r.name,
      label: r.type ?? 'Unknown',
      filePath: r.filePath,
      distance: 1 - r.score,
      startLine: r.startLine,
      endLine: r.endLine,
    }));

    const merged = mergeWithRRF(bm25Mapped, semanticMapped, limit);
    return merged.map((r: any) => ({
      filePath: r.filePath,
      score: r.score,
      rank: r.rank,
      sources: r.sources,
      nodeId: r.nodeId,
      name: r.name,
      type: r.label,
      startLine: r.startLine,
      endLine: r.endLine,
      bm25Score: r.bm25Score,
      semanticScore: r.semanticScore,
    }));
  }

  // ── Embedding Operations ──────────────────────────────────────────

  async storeEmbeddings(repo: string, embeddings: EmbeddingRecord[]): Promise<void> {
    if (embeddings.length === 0) return;
    const { executeWithReusedStatement: batchExec } = await import(
      '../lbug/lbug-adapter/query.js'
    );
    const params = embeddings.map((e) => ({
      nodeId: e.nodeId,
      chunkIndex: e.chunkIndex,
      startLine: e.startLine,
      endLine: e.endLine,
      embedding: JSON.stringify(e.embedding),
      contentHash: e.contentHash ?? null,
    }));
    await batchExec(
      `CREATE (e:${EMBEDDING_TABLE_NAME} {nodeId: $nodeId, chunkIndex: $chunkIndex,
        startLine: $startLine, endLine: $endLine,
        embedding: CAST($embedding AS FLOAT[]),
        contentHash: $contentHash})`,
      params,
    );
  }

  async getCachedEmbeddings(repo: string): Promise<EmbeddingRecord[]> {
    const result = await loadCachedEmbeddings();
    return result.embeddings.map((e) => ({
      nodeId: e.nodeId,
      chunkIndex: e.chunkIndex,
      startLine: e.startLine,
      endLine: e.endLine,
      embedding: e.embedding,
      contentHash: e.contentHash,
    }));
  }

  async getCachedEmbeddingHashes(repo: string): Promise<Map<string, string>> {
    const execFn = (cypher: string) => this.executeQuery(repo, cypher);
    return (await fetchExistingEmbeddingHashes(execFn)) ?? new Map<string, string>();
  }

  getEmbeddingTableName(repo: string, table: string): string {
    return getLbugEmbeddingTableName();
  }

  async loadVectorExtension(repo: string): Promise<boolean> {
    return loadLbugVectorExtension();
  }

  // ── Database Stats ────────────────────────────────────────────────

  async getStats(repo: string): Promise<{ nodes: number; edges: number }> {
    return getLbugStats();
  }

  // ── Graph Loading ─────────────────────────────────────────────────

  async loadGraph(repo: string, graph: GraphInput, storagePath?: string): Promise<void> {
    const dbPath = this.repoDbPaths.get(repo);
    if (!dbPath && !storagePath) {
      throw new Error(
        `LadybugGraphDatabaseProvider.loadGraph: no storage path for repo "${repo}". ` +
        `Call initialize() first or provide storagePath.`,
      );
    }

    // Convert GraphInput (backend-agnostic) to KnowledgeGraph (CLI-specific)
    const { createKnowledgeGraph } = await import('../graph/graph.js');
    const kg = createKnowledgeGraph();
    for (const node of graph.nodes) {
      kg.addNode({
        id: node.id,
        label: node.type as any,
        properties: {
          name: node.name,
          filePath: node.filePath ?? '',
          content: node.content,
          startLine: node.startLine,
          endLine: node.endLine,
          description: node.description,
        },
      });
    }
    for (const rel of graph.relationships) {
      kg.addRelationship({
        id: rel.id,
        sourceId: rel.source,
        targetId: rel.target,
        type: rel.type as any,
        confidence: rel.confidence ?? 1.0,
        reason: rel.reason ?? '',
        step: rel.step,
      });
    }

    const repoPath = dbPath ? dbPath.substring(0, dbPath.lastIndexOf('/')) : '';
    const resolvedStoragePath = storagePath ?? dbPath ?? '';
    await loadGraphToLbug(kg as any, repoPath, resolvedStoragePath);
  }
}
