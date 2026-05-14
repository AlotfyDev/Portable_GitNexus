import { FUNCTION_NODE_TYPES, findEnclosingClassInfo, genericFuncName, inferFunctionLabel, } from '../../utils/ast-helpers.js';
import { typeTagForId, constTagForId, buildCollisionGroups } from '../../utils/method-props.js';
import { generateId } from '../../../../lib/utils.js';
import { getLanguageFromFilename } from '../../../../_shared/index.js';
/** Cache for method extraction results in findEnclosingFunction fallback path. */
export const enclosingFnExtractCache = new Map();
/**
 * Walk up the AST from a node to find the enclosing function/method.
 * Returns null if the call is at module/file level (top-level code).
 */
export const findEnclosingFunction = (node, filePath, ctx, provider) => {
    let current = node.parent;
    while (current) {
        if (FUNCTION_NODE_TYPES.has(current.type)) {
            const efnResult = provider.methodExtractor?.extractFunctionName?.(current);
            const funcName = efnResult?.funcName ?? genericFuncName(current);
            const label = efnResult?.label ?? inferFunctionLabel(current.type);
            if (funcName) {
                const resolved = ctx.resolve(funcName, filePath);
                if (resolved?.tier === 'same-file' && resolved.candidates.length > 0) {
                    if (resolved.candidates.length === 1) {
                        return resolved.candidates[0].nodeId;
                    }
                    const classInfo = findEnclosingClassInfo(current, filePath);
                    if (classInfo) {
                        const classMatches = resolved.candidates.filter((c) => c.ownerId === classInfo.classId);
                        if (classMatches.length === 1)
                            return classMatches[0].nodeId;
                        if (classMatches.length > 1) {
                            /* fall through */
                        }
                        else {
                            return resolved.candidates[0].nodeId;
                        }
                    }
                    else {
                        return resolved.candidates[0].nodeId;
                    }
                }
                let finalLabel = label;
                if (provider.labelOverride) {
                    const override = provider.labelOverride(current, label);
                    if (override !== null)
                        finalLabel = override;
                }
                const classInfo2 = findEnclosingClassInfo(current, filePath);
                const qualifiedName = classInfo2 ? `${classInfo2.className}.${funcName}` : funcName;
                const language = getLanguageFromFilename(filePath);
                let arity;
                let encTypeTag = '';
                if ((finalLabel === 'Method' || finalLabel === 'Constructor') &&
                    provider.methodExtractor &&
                    language) {
                    let classNode = current.parent;
                    while (classNode && !provider.methodExtractor.isTypeDeclaration(classNode)) {
                        classNode = classNode.parent;
                    }
                    let info;
                    if (classNode) {
                        let extracted = enclosingFnExtractCache.get(classNode.id);
                        if (extracted === undefined) {
                            extracted =
                                provider.methodExtractor.extract(classNode, { filePath, language }) ?? null;
                            enclosingFnExtractCache.set(classNode.id, extracted);
                        }
                        if (extracted?.methods?.length) {
                            const defLine = current.startPosition.row + 1;
                            info = extracted.methods.find((m) => m.name === funcName && m.line === defLine);
                            if (info) {
                                arity = info.parameters.some((p) => p.isVariadic)
                                    ? undefined
                                    : info.parameters.length;
                            }
                            if (arity !== undefined && info) {
                                const methodMap = new Map();
                                for (const m of extracted.methods)
                                    methodMap.set(`${m.name}:${m.line}`, m);
                                const groups = buildCollisionGroups(methodMap);
                                encTypeTag =
                                    typeTagForId(methodMap, funcName, arity, info, language, groups) +
                                        constTagForId(methodMap, funcName, arity, info, groups);
                            }
                        }
                    }
                    if (!info && provider.methodExtractor.extractFromNode) {
                        const nodeInfo = provider.methodExtractor.extractFromNode(current, {
                            filePath,
                            language,
                        });
                        if (nodeInfo) {
                            arity = nodeInfo.parameters.some((p) => p.isVariadic)
                                ? undefined
                                : nodeInfo.parameters.length;
                        }
                    }
                }
                const arityTag = arity !== undefined ? `#${arity}${encTypeTag}` : '';
                return generateId(finalLabel, `${filePath}:${qualifiedName}${arityTag}`);
            }
        }
        if (provider.enclosingFunctionFinder) {
            const customResult = provider.enclosingFunctionFinder(current);
            if (customResult) {
                const resolved = ctx.resolve(customResult.funcName, filePath);
                if (resolved?.tier === 'same-file' && resolved.candidates.length > 0) {
                    if (resolved.candidates.length === 1) {
                        return resolved.candidates[0].nodeId;
                    }
                    const classInfo = findEnclosingClassInfo(current.previousSibling ?? current, filePath);
                    if (classInfo) {
                        const classMatches = resolved.candidates.filter((c) => c.ownerId === classInfo.classId);
                        if (classMatches.length === 1)
                            return classMatches[0].nodeId;
                        if (classMatches.length > 1) {
                            /* fall through */
                        }
                        else {
                            return resolved.candidates[0].nodeId;
                        }
                    }
                    else {
                        return resolved.candidates[0].nodeId;
                    }
                }
                let finalLabel = customResult.label;
                if (provider.labelOverride) {
                    const override = provider.labelOverride(current.previousSibling, finalLabel);
                    if (override !== null)
                        finalLabel = override;
                }
                const classInfo2 = findEnclosingClassInfo(current.previousSibling ?? current, filePath);
                const qualifiedName = classInfo2
                    ? `${classInfo2.className}.${customResult.funcName}`
                    : customResult.funcName;
                const sigNode = current.previousSibling ?? current;
                const language2 = getLanguageFromFilename(filePath);
                let arity2;
                let encTypeTag2 = '';
                if ((finalLabel === 'Method' || finalLabel === 'Constructor') &&
                    provider.methodExtractor &&
                    language2) {
                    let classNode2 = (current.previousSibling ?? current).parent;
                    while (classNode2 && !provider.methodExtractor.isTypeDeclaration(classNode2)) {
                        classNode2 = classNode2.parent;
                    }
                    let info2;
                    if (classNode2) {
                        let extracted2 = enclosingFnExtractCache.get(classNode2.id);
                        if (extracted2 === undefined) {
                            extracted2 =
                                provider.methodExtractor.extract(classNode2, { filePath, language: language2 }) ??
                                    null;
                            enclosingFnExtractCache.set(classNode2.id, extracted2);
                        }
                        if (extracted2?.methods?.length) {
                            const defLine2 = sigNode.startPosition.row + 1;
                            info2 = extracted2.methods.find((m) => m.name === customResult.funcName && m.line === defLine2);
                            if (info2) {
                                arity2 = info2.parameters.some((p) => p.isVariadic)
                                    ? undefined
                                    : info2.parameters.length;
                            }
                            if (arity2 !== undefined && info2) {
                                const methodMap = new Map();
                                for (const m of extracted2.methods)
                                    methodMap.set(`${m.name}:${m.line}`, m);
                                const groups2 = buildCollisionGroups(methodMap);
                                encTypeTag2 =
                                    typeTagForId(methodMap, customResult.funcName, arity2, info2, language2, groups2) + constTagForId(methodMap, customResult.funcName, arity2, info2, groups2);
                            }
                        }
                    }
                    if (!info2 && provider.methodExtractor.extractFromNode) {
                        const nodeInfo = provider.methodExtractor.extractFromNode(sigNode, {
                            filePath,
                            language: language2,
                        });
                        if (nodeInfo) {
                            arity2 = nodeInfo.parameters.some((p) => p.isVariadic)
                                ? undefined
                                : nodeInfo.parameters.length;
                        }
                    }
                }
                const arityTag2 = arity2 !== undefined ? `#${arity2}${encTypeTag2}` : '';
                return generateId(finalLabel, `${filePath}:${qualifiedName}${arityTag2}`);
            }
        }
        current = current.parent;
    }
    return null;
};
