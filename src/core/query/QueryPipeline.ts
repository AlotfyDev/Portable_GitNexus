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

export interface QueryPipeline {
  /** Initialize pipeline (resolve repos, etc.) */
  init(): Promise<boolean>;

  /** Dispose pipeline (close connections) */
  dispose(): Promise<void>;

  /** Search with mode selection */
  search(
    repo: string,
    query: string,
    mode: 'fts' | 'vector' | 'hybrid',
    limit?: number,
  ): Promise<SearchResult[]>;

  /** Full-text search via BM25 */
  searchFTS(repo: string, query: string, limit?: number): Promise<SearchResult[]>;

  /** Semantic / vector search */
  searchVector(repo: string, query: string, limit?: number): Promise<SearchResult[]>;

  /** Hybrid search (BM25 + vector with RRF fusion) */
  searchHybrid(repo: string, query: string, limit?: number): Promise<SearchResult[]>;

  /** Graph RAG query with LLM reasoning */
  queryRAG(repo: string, question: string, options: RAGOptions): Promise<RAGResult>;

  /** Get full graph data (all nodes + relationships) */
  getGraph(
    repo: string,
    options?: { includeContent?: boolean },
  ): Promise<GraphData>;

  /** Get all processes */
  getProcesses(repo: string): Promise<ProcessData[]>;

  /** Get symbol detail by ID */
  getSymbol(repo: string, symbolId: string): Promise<SymbolDetail | null>;

  /** Impact analysis for a symbol */
  analyzeImpact(
    repo: string,
    symbolId: string,
    options?: {
      direction?: 'upstream' | 'downstream';
      maxDepth?: number;
      relationTypes?: string[];
      includeTests?: boolean;
      minConfidence?: number;
    },
  ): Promise<ImpactResult>;

  /** Detect changes in working tree */
  detectChanges(repo: string, baseCommit?: string): Promise<ChangeResult>;

  /** Get full symbol context (incoming/outgoing/processes) */
  getSymbolContext(repo: string, symbolId: string): Promise<SymbolContext>;

  /** Execute arbitrary Cypher query (read-only) */
  cypher(repo: string, query: string): Promise<any[]>;
}
