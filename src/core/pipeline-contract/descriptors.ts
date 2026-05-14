import type { PipelineId, PipelineContract, PipelineContext } from './types.js';
import type { IngestionOutput, LadybugStats, EmbeddingConfig, EmbeddingResult, EmbeddingCache, AnalysisMetadata, EmbeddingMode } from './stages.js';

export const STAGE_IDS = {
  INGESTION: 'ingestion' as PipelineId,
  LADYBUGDB: 'ladybugdb' as PipelineId,
  SEARCH: 'search' as PipelineId,
  EMBEDDINGS: 'embeddings' as PipelineId,
  FINALIZE: 'finalize' as PipelineId,
} as const;

export const STAGE_DEPENDENCIES: Record<string, string[]> = {
  ingestion: [],
  ladybugdb: ['ingestion'],
  search: ['ladybugdb'],
  embeddings: ['ladybugdb'],
  finalize: ['ingestion', 'ladybugdb', 'search', 'embeddings'],
};

export interface ResourceRequirement {
  id: string;
  label: string;
  criticality: 'fatal' | 'degrade' | 'warn';
  helpUrl?: string;
}

export const STAGE_RESOURCES: Record<string, ResourceRequirement[]> = {
  ingestion: [
    { id: 'wasm-runtime', label: 'web-tree-sitter WASM runtime', criticality: 'fatal' },
    { id: 'grammars', label: 'Tree-sitter language grammars', criticality: 'degrade' },
    { id: 'source-files', label: 'Source code files to analyze', criticality: 'fatal' },
  ],
  ladybugdb: [
    { id: 'ladybugdb-core', label: '@ladybugdb/core package', criticality: 'fatal' },
    { id: 'disk-space', label: 'Disk space for LadybugDB', criticality: 'fatal' },
  ],
  search: [
    { id: 'ladybugdb-core', label: '@ladybugdb/core package', criticality: 'fatal' },
  ],
  embeddings: [
    { id: 'embedding-model', label: 'ONNX embedding model files', criticality: 'fatal' },
    { id: 'onnx-runtime', label: 'ONNX Runtime (WASM or native)', criticality: 'fatal' },
    { id: 'memory', label: 'Sufficient RAM for embedding', criticality: 'fatal' },
    { id: 'model-cap', label: 'Node count within safety cap', criticality: 'degrade' },
  ],
  finalize: [
    { id: 'filesystem', label: 'Write access to .gitnexus/', criticality: 'fatal' },
  ],
};

export interface ArtifactDescriptor {
  stageId: string;
  dependsOn: string[];
  description: string;
}

export const STAGE_ARTIFACTS: ArtifactDescriptor[] = [
  { stageId: 'ingestion', dependsOn: ['git-commit'], description: 'Git commit hash or directory mtime' },
  { stageId: 'ladybugdb', dependsOn: ['ingestion'], description: 'Hash of graph structure (node count + label distribution)' },
  { stageId: 'embeddings', dependsOn: ['ingestion', 'model-config'], description: 'Graph fingerprint + content hashes of embeddable nodes' },
];
