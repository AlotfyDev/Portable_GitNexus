import { filterCallableCandidates, toResolveResult } from './callable-candidates.js';
import { disambiguateByOverloadOrArgTypes } from './overload-disambiguation.js';
export const resolveMemberCallByFile = (calledName, receiverTypeName, currentFile, ctx, argCount, callForm, overloadHints, preComputedArgTypes) => {
    const typeResolved = ctx.resolve(receiverTypeName, currentFile);
    if (!typeResolved || typeResolved.candidates.length === 0)
        return null;
    const typeNodeIds = new Set(typeResolved.candidates.map((d) => d.nodeId));
    const typeFiles = new Set(typeResolved.candidates.map((d) => d.filePath));
    const rawCallablePool = ctx.model.symbols.lookupCallableByName(calledName);
    const rawMethodPool = ctx.model.methods.lookupMethodByName(calledName);
    const combinedPool = [];
    const combinedSeen = new Set();
    for (const def of rawCallablePool) {
        if (combinedSeen.has(def.nodeId))
            continue;
        combinedSeen.add(def.nodeId);
        combinedPool.push(def);
    }
    for (const def of rawMethodPool) {
        if (combinedSeen.has(def.nodeId))
            continue;
        combinedSeen.add(def.nodeId);
        combinedPool.push(def);
    }
    const methodPool = filterCallableCandidates(combinedPool, argCount, callForm);
    const fileFiltered = methodPool.filter((c) => typeFiles.has(c.filePath));
    if (fileFiltered.length === 1) {
        return toResolveResult(fileFiltered[0], typeResolved.tier);
    }
    const pool = fileFiltered.length > 0 ? fileFiltered : methodPool;
    const ownerFiltered = pool.filter((c) => c.ownerId && typeNodeIds.has(c.ownerId));
    if (ownerFiltered.length === 1)
        return toResolveResult(ownerFiltered[0], typeResolved.tier);
    if (fileFiltered.length > 1 || ownerFiltered.length > 1) {
        const overloadPool = ownerFiltered.length > 1 ? ownerFiltered : fileFiltered;
        const disambiguated = disambiguateByOverloadOrArgTypes(overloadPool, overloadHints, preComputedArgTypes);
        if (disambiguated)
            return toResolveResult(disambiguated, typeResolved.tier);
    }
    return null;
};
