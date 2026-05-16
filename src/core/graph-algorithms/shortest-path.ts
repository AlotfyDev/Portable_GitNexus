import type { KnowledgeGraph } from '../graph/types.js';

export interface ShortestPathResult {
  path: string[];
  length: number;
  found: boolean;
}

export interface AllShortestPathsResult {
  from: string;
  to: string;
  paths: ShortestPathResult[];
}

export function findShortestPath(
  kg: KnowledgeGraph,
  sourceId: string,
  targetId: string,
  relTypes?: Set<string>,
): ShortestPathResult {
  if (sourceId === targetId) {
    return { path: [sourceId], length: 0, found: true };
  }

  const adjacency = new Map<string, string[]>();
  kg.forEachRelationship((rel) => {
    if (relTypes && !relTypes.has(rel.type)) return;
    if (!adjacency.has(rel.sourceId)) adjacency.set(rel.sourceId, []);
    adjacency.get(rel.sourceId)!.push(rel.targetId);
  });

  const visited = new Set<string>([sourceId]);
  const predecessors = new Map<string, string | null>([[sourceId, null]]);
  const queue = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];

    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        predecessors.set(next, current);
        if (next === targetId) {
          const path: string[] = [];
          let node: string | null = next;
          while (node !== null) {
            path.unshift(node);
            node = predecessors.get(node) ?? null;
          }
          return { path, length: path.length - 1, found: true };
        }
        queue.push(next);
      }
    }
  }

  return { path: [], length: -1, found: false };
}

export function findShortestPaths(
  kg: KnowledgeGraph,
  sourceId: string,
  targetId: string,
  maxPaths: number = 5,
  relTypes?: Set<string>,
): ShortestPathResult[] {
  const paths: ShortestPathResult[] = [];

  const adjacency = new Map<string, string[]>();
  kg.forEachRelationship((rel) => {
    if (relTypes && !relTypes.has(rel.type)) return;
    if (!adjacency.has(rel.sourceId)) adjacency.set(rel.sourceId, []);
    adjacency.get(rel.sourceId)!.push(rel.targetId);
  });

  interface QueueItem {
    path: string[];
    visited: Set<string>;
  }

  const queue: QueueItem[] = [{ path: [sourceId], visited: new Set([sourceId]) }];
  let shortestLength = Infinity;

  while (queue.length > 0 && paths.length < maxPaths) {
    const { path, visited } = queue.shift()!;
    const current = path[path.length - 1];
    const neighbors = adjacency.get(current) ?? [];

    for (const next of neighbors) {
      if (visited.has(next)) continue;
      if (path.length + 1 > shortestLength) continue;

      const newPath = [...path, next];
      if (next === targetId) {
        shortestLength = newPath.length - 1;
        paths.push({ path: newPath, length: newPath.length - 1, found: true });
      } else {
        const newVisited = new Set(visited);
        newVisited.add(next);
        queue.push({ path: newPath, visited: newVisited });
      }
    }
  }

  return paths.length > 0 ? paths : [{ path: [], length: -1, found: false }];
}

export function findNeighbors(
  kg: KnowledgeGraph,
  nodeId: string,
  depth: number = 1,
  relTypes?: Set<string>,
): Map<string, number> {
  const result = new Map<string, number>();
  if (depth < 1) return result;

  const adjacency = new Map<string, string[]>();
  kg.forEachRelationship((rel) => {
    if (relTypes && !relTypes.has(rel.type)) return;
    if (!adjacency.has(rel.sourceId)) adjacency.set(rel.sourceId, []);
    adjacency.get(rel.sourceId)!.push(rel.targetId);
  });

  const queue: Array<{ id: string; dist: number }> = [{ id: nodeId, dist: 0 }];
  const visited = new Set<string>([nodeId]);

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    if (dist > 0) result.set(id, dist);
    if (dist >= depth) continue;

    const neighbors = adjacency.get(id) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, dist: dist + 1 });
      }
    }
  }

  return result;
}
