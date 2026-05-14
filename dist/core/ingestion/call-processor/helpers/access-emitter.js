import { generateId } from '../../../../lib/utils.js';
export const makeAccessEmitter = (graph, sourceId) => {
    const emitted = new Set();
    return (fieldNodeId) => {
        const key = `${sourceId}\0${fieldNodeId}`;
        if (emitted.has(key))
            return;
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
