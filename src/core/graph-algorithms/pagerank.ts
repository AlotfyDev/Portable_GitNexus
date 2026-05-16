import type { KnowledgeGraph } from '../graph/types.js';

export interface PageRankOptions {
  damping?: number;
  maxIterations?: number;
  tolerance?: number;
}

export interface PageRankResult {
  nodeId: string;
  score: number;
  rank: number;
}

const DEFAULT_DAMPING = 0.85;
const DEFAULT_MAX_ITERATIONS = 100;
const DEFAULT_TOLERANCE = 1e-6;

export function computePageRank(
  kg: KnowledgeGraph,
  options: PageRankOptions = {},
): PageRankResult[] {
  const damping = options.damping ?? DEFAULT_DAMPING;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

  const outboundCount = new Map<string, number>();
  const inboundNeighbors = new Map<string, string[]>();

  kg.forEachRelationship((rel) => {
    if (!rel.type || rel.sourceId === rel.targetId) return;
    outboundCount.set(rel.sourceId, (outboundCount.get(rel.sourceId) ?? 0) + 1);
    if (!inboundNeighbors.has(rel.targetId)) inboundNeighbors.set(rel.targetId, []);
    inboundNeighbors.get(rel.targetId)!.push(rel.sourceId);
  });

  const nodeIds = new Set<string>();
  kg.forEachNode((node) => nodeIds.add(node.id));

  const scores = new Map<string, number>();
  const numNodes = nodeIds.size;
  if (numNodes === 0) return [];
  const initialScore = 1 / numNodes;
  for (const id of nodeIds) scores.set(id, initialScore);
  for (const id of inboundNeighbors.keys()) {
    if (!scores.has(id)) scores.set(id, initialScore);
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxDiff = 0;
    const next = new Map<string, number>();
    const danglingScore = (1 - damping) / numNodes;

    let danglingSum = 0;
    for (const [id, count] of outboundCount) {
      if (count === 0) danglingSum += scores.get(id) ?? 0;
    }
    const danglingContribution = (damping * danglingSum) / numNodes;

    for (const id of scores.keys()) {
      let sum = 0;
      const neighbors = inboundNeighbors.get(id);
      if (neighbors) {
        for (const n of neighbors) {
          const outCount = outboundCount.get(n) ?? 1;
          sum += (scores.get(n) ?? 0) / outCount;
        }
      }
      next.set(id, danglingScore + danglingContribution + damping * sum);
      const diff = Math.abs((next.get(id) ?? 0) - (scores.get(id) ?? 0));
      if (diff > maxDiff) maxDiff = diff;
    }

    for (const [id, score] of next) scores.set(id, score);
    if (maxDiff < tolerance) break;
  }

  return Array.from(scores.entries())
    .map(([nodeId, score]) => ({ nodeId, score }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
