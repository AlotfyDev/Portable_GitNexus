import type { QueryPipeline } from './QueryPipeline.js';
import type {
  SearchResult,
  RAGOptions,
  RAGResult,
  GraphData,
  ProcessData,
  SymbolDetail,
  ImpactResult,
  ChangeResult,
  SymbolContext,
} from './types.js';
import { StateManager } from './helpers/state-manager.js';
import type { GraphDatabaseProvider } from '../storage/GraphDatabaseProvider.js';
import { NODE_TABLES, type GraphNode, type GraphRelationship } from 'gitnexus-shared';
import type { SemanticSearchResult } from '../embeddings/types.js';

const GRAPH_RELATIONSHIP_QUERY =
  `MATCH (a)-[r:CodeRelation]->(b) RETURN a.id AS sourceId, b.id AS targetId, ` +
  `r.type AS type, r.confidence AS confidence, r.reason AS reason, r.step AS step`;

const quoteNodeTable = (table: string): string => `\`${table.replace(/`/g, '``')}\``;

const getNodeQuery = (table: string, includeContent: boolean): string => {
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

const mapGraphNodeRow = (table: string, row: any, includeContent: boolean): GraphNode => ({
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
});

const mapGraphRelationshipRow = (row: any): GraphRelationship => ({
  id: `${row.sourceId}_${row.type}_${row.targetId}`,
  type: row.type,
  sourceId: row.sourceId,
  targetId: row.targetId,
  confidence: row.confidence,
  reason: row.reason,
  step: row.step,
});

const isIgnorableGraphQueryError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('No table named')
  );
};

export class QueryPipelineImpl implements QueryPipeline {
  private ctx: StateManager;

  constructor(private db: GraphDatabaseProvider, ctx?: StateManager) {
    this.ctx = ctx ?? new StateManager();
  }

  async init(): Promise<boolean> {
    return this.ctx.init();
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  async search(
    repo: string,
    query: string,
    mode: 'fts' | 'vector' | 'hybrid',
    limit = 10,
  ): Promise<SearchResult[]> {
    switch (mode) {
      case 'fts':
        return this.searchFTS(repo, query, limit);
      case 'vector':
        return this.searchVector(repo, query, limit);
      case 'hybrid':
        return this.searchHybrid(repo, query, limit);
    }
  }

  async searchFTS(repo: string, query: string, limit = 10): Promise<SearchResult[]> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { bm25Search } = await import('./helpers/search.js');
    const result = await bm25Search(handle, query, limit);
    return result.results.map((r: any) => ({
      nodeId: r.nodeId,
      name: r.name,
      type: r.type || 'File',
      filePath: r.filePath,
      score: r.bm25Score ?? 0,
      startLine: r.startLine,
      endLine: r.endLine,
      sources: ['bm25'],
    }));
  }

  async searchVector(repo: string, query: string, limit = 10): Promise<SearchResult[]> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { semanticSearch } = await import('./helpers/search.js');
    const results = await semanticSearch(this.ctx, handle, query, limit);
    return results.map((r: any) => ({
      nodeId: r.nodeId,
      name: r.name,
      type: r.type || r.label || 'Unknown',
      filePath: r.filePath,
      score: r.distance !== undefined ? 1 - r.distance : 0,
      startLine: r.startLine,
      endLine: r.endLine,
      sources: ['semantic'],
    }));
  }

  async searchHybrid(repo: string, query: string, limit = 10): Promise<SearchResult[]> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { bm25Search, semanticSearch } = await import('./helpers/search.js');
    const { mergeWithRRF } = await import('../search/hybrid-search.js');

    const fetchLimit = Math.max(limit * 3, 30);
    const [bm25Result, semanticResult] = await Promise.all([
      bm25Search(handle, query, fetchLimit),
      semanticSearch(this.ctx, handle, query, fetchLimit),
    ]);

    const bm25Mapped = bm25Result.results.map((r: any) => ({
      filePath: r.filePath,
      score: r.bm25Score ?? 0,
      rank: 0,
      nodeIds: r.nodeId ? [r.nodeId] : undefined,
    }));

    const semanticMapped: SemanticSearchResult[] = semanticResult.map((r: any) => ({
      nodeId: r.nodeId,
      name: r.name,
      label: r.type || r.label || 'Unknown',
      filePath: r.filePath,
      distance: r.distance ?? 0.5,
      startLine: r.startLine,
      endLine: r.endLine,
    }));

    const merged = mergeWithRRF(bm25Mapped, semanticMapped, limit);
    return merged.map((r) => ({
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

  async queryRAG(repo: string, question: string, options: RAGOptions): Promise<RAGResult> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { createGraphRAGAgent, invokeAgent } = await import('../llm/graph-rag-agent.js');
    const { createReadOnlyBackend } = await import('./helpers/rag-backend.js');

    const backend = createReadOnlyBackend(handle, this.ctx);

    let codebaseContext: any = undefined;
    if (!options.context) {
      try {
        const { getCodebaseStats, getHotspots, getFolderTree } = await import('../llm/context-builder.js');
        const execFn = (cypher: string) => backend.executeQuery(cypher);
        const stats = await getCodebaseStats(execFn, handle.name);
        const hotspots = await getHotspots(execFn);
        const folderTree = await getFolderTree(execFn);
        codebaseContext = { stats, hotspots, folderTree };
      } catch {
        // Context building is best-effort for RAG
      }
    }

    const agent = createGraphRAGAgent(options.provider, backend, codebaseContext);
    const userMessages = options.messages ?? [];
    const answer = await invokeAgent(agent, [
      ...userMessages,
      { role: 'user' as const, content: question },
    ]);

    return { answer };
  }

  async getGraph(
    repo: string,
    options?: { includeContent?: boolean },
  ): Promise<GraphData> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);
    const includeContent = options?.includeContent ?? false;

    const nodes: GraphNode[] = [];
    for (const table of NODE_TABLES) {
      try {
        const rows = await this.db.executeQuery(handle.id, getNodeQuery(table, includeContent));
        for (const row of rows) {
          nodes.push(mapGraphNodeRow(table, row, includeContent));
        }
      } catch (err) {
        if (!isIgnorableGraphQueryError(err)) throw err;
      }
    }

    const relationships: GraphRelationship[] = [];
    const relRows = await this.db.executeQuery(handle.id, GRAPH_RELATIONSHIP_QUERY);
    for (const row of relRows) {
      relationships.push(mapGraphRelationshipRow(row));
    }

    return { nodes, relationships };
  }

  async getProcesses(repo: string): Promise<ProcessData[]> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { queryProcesses } = await import('./helpers/graph-queries.js');
    const result = await queryProcesses(handle, 100);
    return result.processes.map((p: any) => ({
      id: p.id,
      label: p.label,
      heuristicLabel: p.heuristicLabel,
      processType: p.processType,
      stepCount: p.stepCount,
    }));
  }

  async getSymbol(repo: string, symbolId: string): Promise<SymbolDetail | null> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { executeContext } = await import('./helpers/context-tools.js');
    const result = await executeContext(handle, { uid: symbolId });
    if (result.error) return null;
    return result.symbol;
  }

  async analyzeImpact(
    repo: string,
    symbolId: string,
    options?: {
      direction?: 'upstream' | 'downstream';
      maxDepth?: number;
      relationTypes?: string[];
      includeTests?: boolean;
      minConfidence?: number;
    },
  ): Promise<ImpactResult> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { executeImpactByUid } = await import('./helpers/impact.js');
    const result = await executeImpactByUid(
      this.ctx,
      handle.id,
      symbolId,
      options?.direction ?? 'upstream',
      {
        maxDepth: options?.maxDepth ?? 3,
        relationTypes: options?.relationTypes ?? ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'METHOD_OVERRIDES', 'OVERRIDES', 'METHOD_IMPLEMENTS'],
        includeTests: options?.includeTests ?? false,
        minConfidence: options?.minConfidence ?? 0,
      },
    );
    return result;
  }

  async detectChanges(repo: string, baseCommit?: string): Promise<ChangeResult> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { executeDetectChanges } = await import('./helpers/detect-changes.js');
    const result = await executeDetectChanges(handle, {
      scope: baseCommit ? 'compare' : 'unstaged',
      base_ref: baseCommit,
    });
    return result;
  }

  async getSymbolContext(repo: string, symbolId: string): Promise<SymbolContext> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { executeContext } = await import('./helpers/context-tools.js');
    const result = await executeContext(handle, { uid: symbolId });
    if (result.error) throw new Error(result.error);
    return result;
  }

  async cypher(repo: string, query: string): Promise<any[]> {
    const handle = await this.ctx.resolveRepo(repo);
    await this.ctx.ensureInitialized(handle.id);

    const { executeCypher } = await import('./helpers/context-tools.js');
    const raw = await executeCypher(handle, { query });
    if (raw.error) throw new Error(raw.error);
    return raw;
  }

}
