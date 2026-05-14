export function findInterfaceDispatchTargets(calledName, receiverTypeName, currentFile, ctx, heritageMap, primaryNodeId) {
    const implFiles = heritageMap.getImplementorFiles(receiverTypeName);
    if (implFiles.size === 0)
        return [];
    const typeResolved = ctx.resolve(receiverTypeName, currentFile);
    if (!typeResolved)
        return [];
    if (!typeResolved.candidates.some((c) => c.type === 'Interface'))
        return [];
    const results = [];
    for (const implFile of implFiles) {
        const methods = ctx.model.symbols.lookupExactAll(implFile, calledName);
        for (const method of methods) {
            if (method.nodeId !== primaryNodeId) {
                results.push({
                    nodeId: method.nodeId,
                    confidence: 0.7,
                    reason: 'interface-dispatch',
                });
            }
        }
    }
    return results;
}
