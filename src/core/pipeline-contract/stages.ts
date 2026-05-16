import type { PipelineId, PipelineContract, PipelineContext } from './types.js';

// Planned for future GPU support — currently only 'cpu' is implemented
export type Device = 'wasm' | 'cpu' | 'cuda' | 'dml' | 'remote';

export interface IngestionOutput {
  graph: unknown;
  repoPath: string;
}

export interface LadybugStats {
  nodes: number;
  edges: number;
  communities?: number;
  processes?: number;
}

export interface EmbeddingResult {
  semanticMode: 'vector-index' | 'exact-scan' | undefined;
  embeddingsCount: number;
}


