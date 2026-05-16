export interface BoostConfig {
  llmProvider?: 'openai' | 'anthropic' | 'ollama' | 'gemini';
  llmModel?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  batchSize?: number;
  maxTokens?: number;
}

export interface ClusterEnrichOutput {
  enrichCount: number;
  tokensUsed: number;
  durationMs: number;
}

export interface NodeDescribeOutput {
  describedCount: number;
  tokensUsed: number;
  durationMs: number;
}

export interface GraphLayoutOutput {
  nodeCount: number;
  edgeCount: number;
  algorithm: string;
  iterations: number;
  durationMs: number;
}

export interface BoostPipelineOutput {
  clusterEnrich: ClusterEnrichOutput | undefined;
  nodeDescribe: NodeDescribeOutput | undefined;
  graphLayout: GraphLayoutOutput | undefined;
}
