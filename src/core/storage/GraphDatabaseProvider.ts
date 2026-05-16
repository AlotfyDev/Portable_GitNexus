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

/**
 * GraphDatabaseProvider
 *
 * Abstract interface for graph database operations, following the
 * IVecDBProvider pattern from src/core/vector-store/provider.ts.
 *
 * This interface decouples ALL database consumers (pipeline stages, query
 * helpers, MCP tools, server routes) from the concrete LadybugDB implementation.
 * Every backend (LadybugDB, Neo4j, Kuzu, SQLite, etc.) implements this contract.
 */
export interface GraphDatabaseProvider {
  // ── Lifecycle ────────────────────────────────────────────────────────

  /** Provider name for identification and logging */
  readonly name: string;

  /** Initialize a repo's database connection pool */
  initialize(repo: string, config?: DBConfig): Promise<void>;

  /** Close and release all resources for a repo */
  close(repo: string): Promise<void>;

  /** Close all repos */
  closeAll(): Promise<void>;

  /** Check if a repo's database is ready for queries */
  isReady(repo: string): boolean;

  // ── Raw Cypher / Prepared Execution ──────────────────────────────────

  /** Execute a raw Cypher query (read-only) */
  executeQuery(repo: string, cypher: string): Promise<any[]>;

  /** Execute a parameterized Cypher query (read-only) */
  executeParameterized(repo: string, cypher: string, params: Record<string, any>): Promise<any[]>;

  /** Execute a prepared/parameterized Cypher query (alias for executeParameterized) */
  executePrepared(repo: string, cypher: string, params: Record<string, any>): Promise<any[]>;

  /** Execute a write Cypher with batched parameters */
  executeBatch(repo: string, cypher: string, paramsList: Array<Record<string, any>>): Promise<void>;

  // ── Session Operations ──────────────────────────────────────────────

  /** Execute an operation within the repo's database session */
  withLbugDb<T>(repo: string, operation: () => Promise<T>): Promise<T>;

  /** Reset idle timer for a repo's database connection */
  touchRepo(repo: string): void;

  // ── Node Operations ──────────────────────────────────────────────────

  /** Get a single node by ID */
  getNode(repo: string, id: string): Promise<GraphNode | null>;

  /** Get multiple nodes by IDs */
  getNodes(repo: string, ids: string[]): Promise<GraphNode[]>;

  /** Search nodes by name/label with text prefix matching */
  searchNodes(repo: string, query: string, limit?: number): Promise<GraphNode[]>;

  // ── Graph Operations ─────────────────────────────────────────────────

  /** Retrieve a subgraph filtered by options */
  getGraph(repo: string, options?: GraphQuery): Promise<GraphData>;

  /** Get all relationships for a specific node */
  getRelationships(repo: string, nodeId: string): Promise<GraphRelationship[]>;

  // ── Full-Text Search ─────────────────────────────────────────────────

  /** Search via BM25 FTS indexes */
  searchFTS(repo: string, query: string, limit?: number): Promise<SearchResult[]>;

  /** Create or ensure FTS indexes exist */
  createFTSIndexes(repo: string): Promise<void>;

  /** Raw FTS query against a specific index */
  queryFTS(repo: string, query: string): Promise<FTSResult[]>;

  // ── Vector / Semantic Search ─────────────────────────────────────────

  /** Search via vector embeddings */
  searchVector(repo: string, query: string, limit?: number): Promise<SearchResult[]>;

  /** Combined BM25 + vector search with RRF fusion */
  searchHybrid(repo: string, query: string, limit?: number): Promise<SearchResult[]>;

  // ── Embedding Operations ─────────────────────────────────────────────

  /** Store embeddings for multiple nodes */
  storeEmbeddings(repo: string, embeddings: EmbeddingRecord[]): Promise<void>;

  /** Load all cached embeddings from the database */
  getCachedEmbeddings(repo: string): Promise<EmbeddingRecord[]>;

  /** Fetch existing embedding content hashes for change detection */
  getCachedEmbeddingHashes(repo: string): Promise<Map<string, string>>;

  /** Get the embedding table name (backend-specific) */
  getEmbeddingTableName(repo: string, table: string): string;

  // ── Extension Loading ───────────────────────────────────────────────

  /** Ensure the vector extension is loaded */
  loadVectorExtension(repo: string): Promise<boolean>;

  // ── Database Stats ───────────────────────────────────────────────────

  /** Get node and edge counts */
  getStats(repo: string): Promise<{ nodes: number; edges: number }>;

  // ── Graph Loading ────────────────────────────────────────────────────

  /** Load a complete graph into the database (bulk write) */
  loadGraph(repo: string, graph: GraphInput, storagePath?: string): Promise<void>;
}
