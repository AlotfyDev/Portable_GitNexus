export interface GraphNode {
  id: string;
  type: string;
  name: string;
  filePath?: string;
  [key: string]: unknown;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface EmbeddingRecord {
  nodeId: string;
  embedding: number[];
  hash?: string;
  modelId?: string;
  dimensions?: number;
}
