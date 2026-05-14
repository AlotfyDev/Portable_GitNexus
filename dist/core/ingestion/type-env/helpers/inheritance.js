import { MAX_MRO_DEPTH } from '../constants.js';
export const isSubclassOf = (child, parent, parentMap) => {
    if (!parentMap || child === parent)
        return false;
    const visited = new Set([child]);
    let current = [child];
    for (let depth = 0; depth < MAX_MRO_DEPTH && current.length > 0; depth++) {
        const next = [];
        for (const cls of current) {
            const parents = parentMap.get(cls);
            if (!parents)
                continue;
            for (const p of parents) {
                if (p === parent)
                    return true;
                if (!visited.has(p)) {
                    visited.add(p);
                    next.push(p);
                }
            }
        }
        current = next;
    }
    return false;
};
export const walkParentChain = (typeName, parentMap, getClassDefs, lookupOnClass) => {
    if (!parentMap)
        return undefined;
    const visited = new Set([typeName]);
    let current = [typeName];
    for (let depth = 0; depth < MAX_MRO_DEPTH && current.length > 0; depth++) {
        const next = [];
        for (const cls of current) {
            const parents = parentMap.get(cls);
            if (!parents)
                continue;
            for (const parent of parents) {
                if (visited.has(parent))
                    continue;
                visited.add(parent);
                const parentDefs = getClassDefs(parent);
                if (parentDefs.length === 1) {
                    const result = lookupOnClass(parentDefs[0].nodeId);
                    if (result !== undefined)
                        return result;
                }
                next.push(parent);
            }
        }
        current = next;
    }
    return undefined;
};
