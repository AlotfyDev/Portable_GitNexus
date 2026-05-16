import type { KnowledgeGraph } from '../graph/types.js';

/**
 * Backend-agnostic configuration for graph database providers.
 * Mirrors the `graph_db` config section from src/config/types.ts.
 */
export interface DBConfig {
  backend?: 'ladybug' | 'neo4j' | 'kuzu' | 'custom';
  connection?: string;
  queryLanguage?: 'cypher' | 'sql' | 'custom';
  wrapperPath?: string;
}

/**
 * A single node in the graph, backend-agnostic.
 */
export interface GraphNode {
  id: string;
  type: string;
  name: string;
  filePath?: string;
  content?: string;
  startLine?: number;
  endLine?: number;
  description?: string;
  [key: string]: unknown;
}

/**
 * A relationship (edge) between two nodes.
 */
export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence?: number;
  reason?: string;
  step?: number;
  properties?: Record<string, unknown>;
}

/**
 * Complete graph data returned from queries.
 */
export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

/**
 * Configuration for filtering/limiting graph queries.
 */
export interface GraphQuery {
  nodeIds?: string[];
  labels?: string[];
  relationshipTypes?: string[];
  depth?: number;
  limit?: number;
}

/**
 * An embedding record stored alongside graph nodes.
 */
export interface EmbeddingRecord {
  nodeId: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  embedding: number[];
  contentHash?: string;
}

/**
 * Generic search result from any search strategy (FTS, vector, hybrid).
 */
export interface SearchResult {
  nodeId: string;
  name: string;
  type?: string;
  filePath: string;
  score: number;
  startLine?: number;
  endLine?: number;
  [key: string]: unknown;
}

/**
 * Raw FTS query result.
 */
export interface FTSResult {
  nodeId: string;
  name: string;
  filePath: string;
  score: number;
  [key: string]: any;
}

/**
 * Input graph data for loading into the database.
 * Backend-agnostic representation of a KnowledgeGraph.
 */
export interface GraphInput {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export { KnowledgeGraph };

/**
 * Storage paths for a repo's .gitnexus directory.
 */
export interface StoragePaths {
  storagePath: string;
  lbugPath: string;
  metaPath: string;
}

/**
 * Options for registering a repo in the global registry.
 */
export interface RegisterOptions {
  name?: string;
  allowDuplicateName?: boolean;
}
