import { filterCallableCandidates, toResolveResult } from './callable-candidates.js';
export const resolveModuleAliasedCall = (call, currentFile, ctx, widenCache, tieredOverride) => {
    if (!call.receiverName)
        return null;
    const aliasMap = ctx.moduleAliasMap?.get(currentFile);
    if (!aliasMap)
        return null;
    const moduleFile = aliasMap.get(call.receiverName);
    if (!moduleFile)
        return null;
    const tiered = tieredOverride ?? ctx.resolve(call.calledName, currentFile);
    if (!tiered)
        return null;
    let filtered = filterCallableCandidates(tiered.candidates, call.argCount, call.callForm).filter((c) => c.filePath === moduleFile);
    if (filtered.length === 0) {
        filtered = filterCallableCandidates(tiered.candidates, call.argCount, 'constructor').filter((c) => c.filePath === moduleFile);
    }
    if (filtered.length === 0) {
        const cacheKey = `${call.calledName}\0${moduleFile}`;
        let defs = widenCache?.get(cacheKey);
        if (!defs) {
            const rawCallable = ctx.model.symbols.lookupCallableByName(call.calledName);
            const rawMethods = ctx.model.methods.lookupMethodByName(call.calledName);
            const widenCombined = [];
            const widenSeen = new Set();
            for (const d of rawCallable) {
                if (widenSeen.has(d.nodeId))
                    continue;
                widenSeen.add(d.nodeId);
                widenCombined.push(d);
            }
            for (const d of rawMethods) {
                if (widenSeen.has(d.nodeId))
                    continue;
                widenSeen.add(d.nodeId);
                widenCombined.push(d);
            }
            defs = widenCombined;
            widenCache?.set(cacheKey, defs);
        }
        filtered = filterCallableCandidates(defs, call.argCount, call.callForm).filter((c) => c.filePath === moduleFile);
        if (filtered.length === 0) {
            filtered = filterCallableCandidates(defs, call.argCount, 'constructor').filter((c) => c.filePath === moduleFile);
        }
    }
    return filtered.length === 1 ? toResolveResult(filtered[0], tiered.tier) : null;
};
