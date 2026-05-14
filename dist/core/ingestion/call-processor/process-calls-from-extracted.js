import { generateId } from '../../../lib/utils.js';
import { getLanguageFromFilename } from '../../../_shared/index.js';
import { isRegistryPrimary } from '../registry-primary-flag.js';
import { yieldToEventLoop } from '../utils/event-loop.js';
import { verifyConstructorBindings } from './helpers/constructor-verifier.js';
import { buildReceiverTypeIndex, lookupReceiverType, } from './helpers/receiver-resolution.js';
import { resolveCallTarget, extractFuncNameFromSourceId } from './helpers/resolve-call-target.js';
import { findInterfaceDispatchTargets } from './helpers/interface-dispatch.js';
import { walkMixedChain } from './helpers/mixed-chain.js';
import { makeAccessEmitter } from './helpers/access-emitter.js';
export const processCallsFromExtracted = async (graph, extractedCalls, ctx, onProgress, constructorBindings, heritageMap, bindingAccumulator) => {
    const fileReceiverTypes = new Map();
    if (constructorBindings) {
        for (const { filePath, bindings } of constructorBindings) {
            const verified = verifyConstructorBindings(bindings, filePath, ctx, graph, bindingAccumulator);
            if (verified.size > 0) {
                fileReceiverTypes.set(filePath, buildReceiverTypeIndex(verified));
            }
        }
    }
    const byFile = new Map();
    for (const call of extractedCalls) {
        let list = byFile.get(call.filePath);
        if (!list) {
            list = [];
            byFile.set(call.filePath, list);
        }
        list.push(call);
    }
    const totalFiles = byFile.size;
    let filesProcessed = 0;
    for (const [filePath, calls] of byFile) {
        filesProcessed++;
        if (filesProcessed % 100 === 0) {
            onProgress?.(filesProcessed, totalFiles);
            await yieldToEventLoop();
        }
        const fileLanguage = getLanguageFromFilename(filePath);
        if (fileLanguage && isRegistryPrimary(fileLanguage))
            continue;
        ctx.enableCache(filePath);
        const widenCache = new Map();
        const receiverMap = fileReceiverTypes.get(filePath);
        for (const call of calls) {
            let effectiveCall = call;
            if (!call.receiverTypeName && call.receiverName && receiverMap) {
                const callFuncName = extractFuncNameFromSourceId(call.sourceId);
                const resolvedType = lookupReceiverType(receiverMap, callFuncName, call.receiverName);
                if (resolvedType) {
                    effectiveCall = { ...call, receiverTypeName: resolvedType };
                }
            }
            if (!effectiveCall.receiverTypeName &&
                effectiveCall.receiverName &&
                effectiveCall.callForm === 'member') {
                const typeResolved = ctx.resolve(effectiveCall.receiverName, effectiveCall.filePath);
                if (typeResolved &&
                    typeResolved.candidates.some((d) => d.type === 'Class' ||
                        d.type === 'Interface' ||
                        d.type === 'Struct' ||
                        d.type === 'Enum')) {
                    effectiveCall = { ...effectiveCall, receiverTypeName: effectiveCall.receiverName };
                }
            }
            if (effectiveCall.receiverMixedChain?.length) {
                let currentType = effectiveCall.receiverTypeName;
                if (!currentType && effectiveCall.receiverName && receiverMap) {
                    const callFuncName = extractFuncNameFromSourceId(effectiveCall.sourceId);
                    currentType = lookupReceiverType(receiverMap, callFuncName, effectiveCall.receiverName);
                }
                if (!currentType && effectiveCall.receiverName) {
                    const typeResolved = ctx.resolve(effectiveCall.receiverName, effectiveCall.filePath);
                    if (typeResolved?.candidates.some((d) => d.type === 'Class' ||
                        d.type === 'Interface' ||
                        d.type === 'Struct' ||
                        d.type === 'Enum')) {
                        currentType = effectiveCall.receiverName;
                    }
                }
                if (currentType) {
                    const walkedType = walkMixedChain(effectiveCall.receiverMixedChain, currentType, effectiveCall.filePath, ctx, makeAccessEmitter(graph, effectiveCall.sourceId), heritageMap);
                    if (walkedType) {
                        effectiveCall = { ...effectiveCall, receiverTypeName: walkedType };
                    }
                }
            }
            const resolved = resolveCallTarget(effectiveCall, effectiveCall.filePath, ctx, undefined, widenCache, effectiveCall.argTypes, heritageMap);
            if (!resolved) {
                if (effectiveCall.filePath.endsWith('.vue') && effectiveCall.sourceId.startsWith('File:')) {
                    const importedFiles = ctx.importMap.get(effectiveCall.filePath);
                    if (importedFiles) {
                        for (const importedPath of importedFiles) {
                            if (!importedPath.endsWith('.vue'))
                                continue;
                            const basename = importedPath.slice(importedPath.lastIndexOf('/') + 1, importedPath.lastIndexOf('.'));
                            if (basename !== effectiveCall.calledName)
                                continue;
                            const targetFileId = generateId('File', importedPath);
                            if (graph.getNode(targetFileId)) {
                                graph.addRelationship({
                                    id: generateId('CALLS', `${effectiveCall.sourceId}:${effectiveCall.calledName}->${targetFileId}`),
                                    sourceId: effectiveCall.sourceId,
                                    targetId: targetFileId,
                                    type: 'CALLS',
                                    confidence: 0.9,
                                    reason: 'vue-template-component',
                                });
                            }
                            break;
                        }
                    }
                }
                continue;
            }
            const relId = generateId('CALLS', `${effectiveCall.sourceId}:${effectiveCall.calledName}->${resolved.nodeId}`);
            graph.addRelationship({
                id: relId,
                sourceId: effectiveCall.sourceId,
                targetId: resolved.nodeId,
                type: 'CALLS',
                confidence: resolved.confidence,
                reason: resolved.reason,
            });
            if (heritageMap && effectiveCall.callForm === 'member' && effectiveCall.receiverTypeName) {
                const implTargets = findInterfaceDispatchTargets(effectiveCall.calledName, effectiveCall.receiverTypeName, effectiveCall.filePath, ctx, heritageMap, resolved.nodeId);
                for (const impl of implTargets) {
                    graph.addRelationship({
                        id: generateId('CALLS', `${effectiveCall.sourceId}:${effectiveCall.calledName}->${impl.nodeId}`),
                        sourceId: effectiveCall.sourceId,
                        targetId: impl.nodeId,
                        type: 'CALLS',
                        confidence: impl.confidence,
                        reason: impl.reason,
                    });
                }
            }
        }
        ctx.clearCache();
    }
    onProgress?.(totalFiles, totalFiles);
};
