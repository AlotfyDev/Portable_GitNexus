import type { PipelineId } from '../pipeline-contract/types.js';

export const BOOST_STAGE_IDS = {
  CLUSTER_ENRICH: 'cluster-enrich' as PipelineId,
  NODE_DESCRIBE: 'node-describe' as PipelineId,
  GRAPH_LAYOUT: 'graph-layout' as PipelineId,
} as const;

export interface ResourceRequirement {
  id: string;
  label: string;
  criticality: 'fatal' | 'degrade' | 'warn';
  helpUrl?: string;
}

export const BOOST_STAGE_DEPENDENCIES: Record<string, string[]> = {
  'cluster-enrich': [],
  'node-describe': [],
  'graph-layout': ['cluster-enrich', 'node-describe'],
};

export const BOOST_STAGE_RESOURCES: Record<string, ResourceRequirement[]> = {
  'cluster-enrich': [
    { id: 'llm-api-key', label: 'LLM provider API key', criticality: 'fatal' },
    { id: 'network-access', label: 'Outbound HTTP to LLM API', criticality: 'fatal' },
    { id: 'tokens', label: 'Token budget / rate limiting', criticality: 'degrade' },
  ],
  'node-describe': [
    { id: 'llm-api-key', label: 'LLM provider API key', criticality: 'fatal' },
    { id: 'network-access', label: 'Outbound HTTP to LLM API', criticality: 'fatal' },
    { id: 'tokens', label: 'Token budget / rate limiting', criticality: 'degrade' },
  ],
  'graph-layout': [
    { id: 'memory', label: 'Sufficient RAM for layout computation', criticality: 'degrade' },
  ],
};

export interface ArtifactDescriptor {
  stageId: string;
  dependsOn: string[];
  description: string;
}

export const BOOST_STAGE_ARTIFACTS: ArtifactDescriptor[] = [
  { stageId: 'cluster-enrich', dependsOn: ['embeddings', 'finalize'], description: 'Embeddings fingerprint + community graph hash' },
  { stageId: 'node-describe', dependsOn: ['embeddings', 'finalize'], description: 'Embeddings fingerprint + node content hash' },
  { stageId: 'graph-layout', dependsOn: ['cluster-enrich', 'node-describe'], description: 'Cluster + description fingerprints' },
];
