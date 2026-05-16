import type { KnowledgeGraph } from '../graph/types.js';

export interface CentralityResult {
  nodeId: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  degreeCentrality: number;
}

export function computeDegreeCentrality(kg: KnowledgeGraph): CentralityResult[] {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const nodes = new Set<string>();

  kg.forEachNode((node) => nodes.add(node.id));

  kg.forEachRelationship((rel) => {
    if (!rel.type || rel.sourceId === rel.targetId) return;
    outDegree.set(rel.sourceId, (outDegree.get(rel.sourceId) ?? 0) + 1);
    inDegree.set(rel.targetId, (inDegree.get(rel.targetId) ?? 0) + 1);
    nodes.add(rel.sourceId);
    nodes.add(rel.targetId);
  });

  if (nodes.size === 0) return [];
  const maxDegree = Math.max(1,
    ...Array.from(nodes, (id) => (outDegree.get(id) ?? 0) + (inDegree.get(id) ?? 0)));

  return Array.from(nodes)
    .map((id) => {
      const dOut = outDegree.get(id) ?? 0;
      const dIn = inDegree.get(id) ?? 0;
      const degree = dOut + dIn;
      return {
        nodeId: id,
        degree,
        inDegree: dIn,
        outDegree: dOut,
        degreeCentrality: degree / maxDegree,
      };
    })
    .sort((a, b) => b.degree - a.degree);
}

export interface BetweennessResult {
  nodeId: string;
  betweenness: number;
  normalized: number;
}

export function computeBetweennessCentrality(
  kg: KnowledgeGraph,
  sampleSize: number = 100,
): BetweennessResult[] {
  const adjacency = new Map<string, string[]>();
  const nodeIds: string[] = [];

  kg.forEachNode((node) => {
    nodeIds.push(node.id);
    if (!adjacency.has(node.id)) adjacency.set(node.id, []);
  });

  kg.forEachRelationship((rel) => {
    if (!rel.type || rel.sourceId === rel.targetId) return;
    if (!adjacency.has(rel.sourceId)) adjacency.set(rel.sourceId, []);
    if (!adjacency.has(rel.targetId)) adjacency.set(rel.targetId, []);
    adjacency.get(rel.sourceId)!.push(rel.targetId);
  });

  const betweenness = new Map<string, number>();
  for (const id of nodeIds) betweenness.set(id, 0);

  const sources = nodeIds.length <= sampleSize
    ? nodeIds
    : nodeIds.sort(() => Math.random() - 0.5).slice(0, sampleSize);

  for (const source of sources) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const distance = new Map<string, number>();
    const delta = new Map<string, number>();

    for (const id of nodeIds) {
      predecessors.set(id, []);
      sigma.set(id, 0);
      distance.set(id, -1);
      delta.set(id, 0);
    }

    sigma.set(source, 1);
    distance.set(source, 0);
    const queue = [source];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      const neighbors = adjacency.get(v) ?? [];
      for (const w of neighbors) {
        const dw = distance.get(w) ?? -1;
        if (dw < 0) {
          queue.push(w);
          distance.set(w, (distance.get(v) ?? 0) + 1);
        }
        if ((distance.get(w) ?? 0) === (distance.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          predecessors.get(w)!.push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of predecessors.get(w) ?? []) {
        delta.set(v, (delta.get(v) ?? 0) + ((sigma.get(v) ?? 0) / (sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0)));
      }
      if (w !== source) {
        betweenness.set(w, (betweenness.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  const scale = nodeIds.length <= sampleSize ? 1 : (nodeIds.length - 1) / (sampleSize - 1);
  const maxBw = Math.max(1, ...betweenness.values());
  const pairCount = (nodeIds.length - 1) * (nodeIds.length - 2) / 2;

  return Array.from(betweenness.entries())
    .map(([nodeId, raw]) => ({
      nodeId,
      betweenness: raw * scale,
      normalized: pairCount > 0 ? (raw * scale) / pairCount : 0,
    }))
    .sort((a, b) => b.betweenness - a.betweenness);
}
