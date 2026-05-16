import Graph from 'graphology';
import forceLayout from 'graphology-layout-force';
import type { PipelineContract } from '../../pipeline-contract/types.js';
import { pid } from '../../pipeline-contract/types.js';
import { BOOST_STAGE_IDS, BOOST_STAGE_RESOURCES } from '../descriptors.js';
import type { GraphLayoutOutput } from '../types.js';
import { executeQuery } from '../../lbug/lbug-adapter.js';

const MAX_LAYOUT_NODES = 50000;
const MAX_LAYOUT_EDGES = 200000;

export function createGraphLayoutStage(): PipelineContract<GraphLayoutOutput> {
  return {
    id: pid(BOOST_STAGE_IDS.GRAPH_LAYOUT),
    label: 'Graph Layout Calculation',
    deps: [pid(BOOST_STAGE_IDS.CLUSTER_ENRICH), pid(BOOST_STAGE_IDS.NODE_DESCRIBE)],
    artifact: {
      version: 1,
      compute: () => `layout-${Date.now()}`,
    },
    resources: BOOST_STAGE_RESOURCES['graph-layout'].map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    run: async (ctx) => {
      ctx.progress('boost', 0, 'Reading graph topology...');

      const nodeRows = await executeQuery(
        `MATCH (n) RETURN n.id LIMIT ${MAX_LAYOUT_NODES}`,
      );
      const edgeRows = await executeQuery(
        `MATCH (n)-[r:CodeRelation]->(m) RETURN n.id AS source, m.id AS target LIMIT ${MAX_LAYOUT_EDGES}`,
      );

      if (!nodeRows || nodeRows.length === 0) {
        ctx.log('[boost] No nodes found — skipping graph layout');
        return { nodeCount: 0, edgeCount: 0, algorithm: 'force', iterations: 0, durationMs: 0 };
      }

      ctx.log(`[boost] Layout: ${nodeRows.length} nodes, ${edgeRows.length} edges`);

      const graph: any = new (Graph as any)({ type: 'directed' });
      for (const node of nodeRows) {
        const id = String((node as Record<string, unknown>).id ?? '');
        if (id) graph.addNode(id);
      }

      for (const edge of edgeRows) {
        const e = edge as Record<string, unknown>;
        const source = String(e.source ?? '');
        const target = String(e.target ?? '');
        if (graph.hasNode(source) && graph.hasNode(target)) {
          try {
            graph.addEdge(source, target);
          } catch {
            // Skip duplicate edges
          }
        }
      }

      ctx.progress('boost', 40, 'Computing force-directed layout...');
      const start = Date.now();
      const iterations = 100;

      (forceLayout as any)(graph, {
        attraction: 0.0005,
        repulsion: 0.1,
        gravity: 0.0001,
        iterations,
      });

      const durationMs = Date.now() - start;
      ctx.log(`[boost] Layout computed in ${durationMs}ms`);

      ctx.progress('boost', 100, 'Graph layout complete');
      return { nodeCount: graph.order, edgeCount: graph.size, algorithm: 'force', iterations, durationMs };
    },
  };
}
