import type { PipelineContext, PipelineId, PipelineContract } from '../pipeline-contract/types.js';
import { createPipelineRunner, pid } from '../pipeline-contract/index.js';
import { BOOST_STAGE_IDS } from './descriptors.js';
import { createClusterEnrichStage } from './impl/cluster-enrich-stage.js';
import { createNodeDescribeStage } from './impl/node-describe-stage.js';
import { createGraphLayoutStage } from './impl/graph-layout-stage.js';
import type { BoostConfig, BoostPipelineOutput, ClusterEnrichOutput, NodeDescribeOutput, GraphLayoutOutput } from './types.js';

export interface BoostRunOptions {
  force?: boolean;
  skip?: string[];
  config?: BoostConfig;
}

export async function runBoostPipeline(
  ctx: PipelineContext,
  options?: BoostRunOptions,
): Promise<BoostPipelineOutput> {
  const contracts: Map<PipelineId, PipelineContract> = new Map();
  contracts.set(pid(BOOST_STAGE_IDS.CLUSTER_ENRICH), createClusterEnrichStage(options?.config));
  contracts.set(pid(BOOST_STAGE_IDS.NODE_DESCRIBE), createNodeDescribeStage(options?.config));
  contracts.set(pid(BOOST_STAGE_IDS.GRAPH_LAYOUT), createGraphLayoutStage());

  const runner = createPipelineRunner(contracts);

  const report = await runner.runPipelines(ctx, {
    force: options?.force,
    skip: options?.skip?.length ? options.skip.map((s) => pid(s)) : undefined,
    failFast: false,
  });

  if (report.failed.length > 0) {
    ctx.log(`[boost] Pipeline stage(s) degraded: ${report.failed.join(', ')}`);
  }
  if (report.skipped.length > 0) {
    ctx.log(`[boost] Pipeline stage(s) skipped: ${report.skipped.join(', ')}`);
  }

  const clusterOutput = report.results.get(pid(BOOST_STAGE_IDS.CLUSTER_ENRICH))?.output as ClusterEnrichOutput | undefined;
  const nodeOutput = report.results.get(pid(BOOST_STAGE_IDS.NODE_DESCRIBE))?.output as NodeDescribeOutput | undefined;
  const layoutOutput = report.results.get(pid(BOOST_STAGE_IDS.GRAPH_LAYOUT))?.output as GraphLayoutOutput | undefined;

  return {
    clusterEnrich: clusterOutput,
    nodeDescribe: nodeOutput,
    graphLayout: layoutOutput,
  };
}
