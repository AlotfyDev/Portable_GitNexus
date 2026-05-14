import { extractReturnTypeName } from '../../type-extractors/shared.js';
import { receiverKey } from './receiver-resolution.js';
/**
 * Verify constructor bindings against SymbolTable and infer receiver types.
 * Shared between sequential (processCalls) and worker (processCallsFromExtracted) paths.
 */
export const verifyConstructorBindings = (bindings, filePath, ctx, graph, bindingAccumulator) => {
    const verified = new Map();
    for (const { scope, varName, calleeName, receiverClassName } of bindings) {
        const tiered = ctx.resolve(calleeName, filePath);
        const isClass = tiered?.candidates.some((def) => def.type === 'Class') ?? false;
        if (isClass) {
            verified.set(receiverKey(scope, varName), calleeName);
        }
        else {
            let callableDefs = tiered?.candidates.filter((d) => d.type === 'Function' || d.type === 'Method');
            if (callableDefs && callableDefs.length > 1 && receiverClassName) {
                if (graph) {
                    const narrowed = callableDefs.filter((d) => {
                        if (!d.ownerId)
                            return false;
                        const owner = graph.getNode(d.ownerId);
                        return owner?.properties.name === receiverClassName;
                    });
                    if (narrowed.length > 0)
                        callableDefs = narrowed;
                }
                else {
                    const classResolved = ctx.resolve(receiverClassName, filePath);
                    if (classResolved && classResolved.candidates.length > 0) {
                        const classNodeIds = new Set(classResolved.candidates.map((c) => c.nodeId));
                        const narrowed = callableDefs.filter((d) => d.ownerId && classNodeIds.has(d.ownerId));
                        if (narrowed.length > 0)
                            callableDefs = narrowed;
                    }
                }
            }
            let typeName;
            if (callableDefs && callableDefs.length === 1 && callableDefs[0].returnType) {
                typeName = extractReturnTypeName(callableDefs[0].returnType);
            }
            const shouldFallback = tiered?.tier !== 'same-file' && (!callableDefs || callableDefs.length <= 1);
            if (!typeName && bindingAccumulator && shouldFallback) {
                const namedImports = ctx.namedImportMap.get(filePath);
                const importBinding = namedImports?.get(calleeName);
                if (importBinding) {
                    const rawType = bindingAccumulator.fileScopeGet(importBinding.sourcePath, importBinding.exportedName);
                    if (rawType) {
                        typeName = extractReturnTypeName(rawType);
                    }
                }
            }
            if (typeName) {
                verified.set(receiverKey(scope, varName), typeName);
            }
        }
    }
    return verified;
};
