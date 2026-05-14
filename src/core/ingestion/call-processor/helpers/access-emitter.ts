import type { KnowledgeGraph } from '../../../graph/types.js';
import type { OnFieldResolved } from '../types.js';
import { generateId } from '../../../../lib/utils.js';

export const makeAccessEmitter = (graph: KnowledgeGraph, sourceId: string): OnFieldResolved => {
  const emitted = new Set<string>();
  return (fieldNodeId: string): void => {
    const key = `${sourceId}\0${fieldNodeId}`;
    if (emitted.has(key)) return;
    emitted.add(key);

    graph.addRelationship({
      id: generateId('ACCESSES', `${sourceId}:${fieldNodeId}:read`),
      sourceId,
      targetId: fieldNodeId,
      type: 'ACCESSES',
      confidence: 1.0,
      reason: 'read',
    });
  };
};
