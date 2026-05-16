/** @deprecated This module appears orphaned (zero external consumers). */
export {
  enrichClusters,
  enrichClustersBatch,
  type CommunityNode,
  type ClusterEnrichment,
  type EnrichmentResult,
  type LLMClient,
  type ClusterMemberInfo,
} from './cluster-enricher.js';

export type {
  BoostConfig,
  ClusterEnrichOutput,
  NodeDescribeOutput,
  GraphLayoutOutput,
  BoostPipelineOutput,
} from './types.js';

export { BOOST_STAGE_IDS, BOOST_STAGE_DEPENDENCIES, BOOST_STAGE_RESOURCES, BOOST_STAGE_ARTIFACTS } from './descriptors.js';
export type { ResourceRequirement, ArtifactDescriptor } from './descriptors.js';

export { createClusterEnrichStage } from './impl/cluster-enrich-stage.js';
export { createNodeDescribeStage } from './impl/node-describe-stage.js';
export { createGraphLayoutStage } from './impl/graph-layout-stage.js';
export { runBoostPipeline } from './pipeline.js';
export type { BoostRunOptions } from './pipeline.js';
