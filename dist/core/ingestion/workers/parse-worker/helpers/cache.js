import { FUNCTION_NODE_TYPES, findEnclosingClassInfo, genericFuncName, inferFunctionLabel, CLASS_CONTAINER_TYPES } from '../../../utils/ast-helpers.js';
import { buildCollisionGroups, typeTagForId, constTagForId } from '../../../utils/method-props.js';
import { getLanguageFromFilename } from '../../../../../_shared/index.js';
import { SupportedLanguages as SupportedLanguagesEnum } from '../../../../../_shared/index.js';
import { generateId } from '../../../../../lib/utils.js';
const classIdCache = new Map();
const functionIdCache = new Map();
const exportCache = new Map();
export const clearCaches = () => {
    classIdCache.clear();
    functionIdCache.clear();
    exportCache.clear();
    fieldInfoCache.clear();
    methodInfoCache.clear();
};
const fieldInfoCache = new Map();
export function findEnclosingClassNode(node) {
    let current = node.parent;
    while (current) {
        if (CLASS_CONTAINER_TYPES.has(current.type)) {
            return current;
        }
        current = current.parent;
    }
    return null;
}
export function findClassNodeByQualifiedName(node) {
    const declarator = node.childForFieldName('declarator');
    if (!declarator)
        return null;
    let funcDecl = null;
    if (declarator.type === 'function_declarator') {
        funcDecl = declarator;
    }
    else {
        let current = declarator;
        while (current && !funcDecl) {
            for (let i = 0; i < current.namedChildCount; i++) {
                const child = current.namedChild(i);
                if (child?.type === 'function_declarator') {
                    funcDecl = child;
                    break;
                }
            }
            if (!funcDecl) {
                const next = current.namedChildren.find((c) => c.type === 'pointer_declarator' || c.type === 'reference_declarator');
                current = next ?? null;
            }
        }
    }
    if (!funcDecl)
        return null;
    const innerDecl = funcDecl.childForFieldName('declarator');
    if (!innerDecl || innerDecl.type !== 'qualified_identifier')
        return null;
    const scope = innerDecl.childForFieldName('scope');
    if (!scope)
        return null;
    const className = scope.text;
    const root = node.tree.rootNode;
    const classTypes = new Set(['class_specifier', 'struct_specifier']);
    const searchIn = (parent) => {
        for (let i = 0; i < parent.namedChildCount; i++) {
            const child = parent.namedChild(i);
            if (!child)
                continue;
            if (classTypes.has(child.type)) {
                const nameNode = child.childForFieldName('name');
                if (nameNode?.text === className)
                    return child;
            }
            if (child.type === 'namespace_definition') {
                const found = searchIn(child);
                if (found)
                    return found;
            }
        }
        return null;
    };
    return searchIn(root);
}
const NOOP_SYMBOL_TABLE = {
    lookupExact: () => undefined,
    lookupExactFull: () => undefined,
    lookupExactAll: () => [],
    lookupCallableByName: () => [],
    getFiles: () => [][Symbol.iterator](),
    getStats: () => ({ fileCount: 0 }),
};
export function getFieldInfo(classNode, provider, context) {
    if (!provider.fieldExtractor)
        return undefined;
    const cacheKey = classNode.startIndex;
    let cached = fieldInfoCache.get(cacheKey);
    if (cached)
        return cached;
    const result = provider.fieldExtractor.extract(classNode, context);
    if (!result?.fields?.length)
        return undefined;
    cached = new Map();
    for (const field of result.fields) {
        cached.set(field.name, field);
    }
    fieldInfoCache.set(cacheKey, cached);
    return cached;
}
const methodInfoCache = new Map();
export function getMethodInfo(classNode, provider, context) {
    if (!provider.methodExtractor)
        return undefined;
    const cacheKey = classNode.startIndex;
    let cached = methodInfoCache.get(cacheKey);
    if (cached)
        return cached;
    const result = provider.methodExtractor.extract(classNode, context);
    if (!result?.methods?.length)
        return undefined;
    cached = new Map();
    for (const method of result.methods) {
        cached.set(`${method.name}:${method.line}`, method);
    }
    methodInfoCache.set(cacheKey, cached);
    return cached;
}
export const findEnclosingFunctionId = (node, filePath, provider) => {
    const cached = functionIdCache.get(node);
    if (cached !== undefined)
        return cached;
    let current = node.parent;
    while (current) {
        if (FUNCTION_NODE_TYPES.has(current.type)) {
            const efnResult = provider.methodExtractor?.extractFunctionName?.(current);
            const funcName = efnResult?.funcName ?? genericFuncName(current);
            const label = efnResult?.label ?? inferFunctionLabel(current.type);
            if (funcName) {
                let finalLabel = label;
                if (provider.labelOverride) {
                    const override = provider.labelOverride(current, label);
                    if (override !== null)
                        finalLabel = override;
                }
                const classInfo = cachedFindEnclosingClassInfo(current, filePath, provider.resolveEnclosingOwner);
                const encLang = getLanguageFromFilename(filePath);
                const standaloneMethodInfo = (finalLabel === 'Method' || finalLabel === 'Constructor') &&
                    encLang === SupportedLanguagesEnum.Go &&
                    provider.methodExtractor?.extractFromNode
                    ? provider.methodExtractor.extractFromNode(current, {
                        filePath,
                        language: encLang,
                    })
                    : null;
                const ownerName = classInfo?.className ?? standaloneMethodInfo?.receiverType ?? undefined;
                const qualifiedName = ownerName ? `${ownerName}.${funcName}` : funcName;
                let arity;
                let encTypeTag = '';
                if (finalLabel === 'Method' || finalLabel === 'Constructor') {
                    if (standaloneMethodInfo) {
                        arity = standaloneMethodInfo.parameters.some((p) => p.isVariadic)
                            ? undefined
                            : standaloneMethodInfo.parameters.length;
                    }
                    else {
                        const classNode = findEnclosingClassNode(current) ?? findClassNodeByQualifiedName(current);
                        if (classNode && encLang) {
                            const methodMap = getMethodInfo(classNode, provider, {
                                filePath,
                                language: encLang,
                            });
                            const defLine = current.startPosition.row + 1;
                            const info = methodMap?.get(`${funcName}:${defLine}`);
                            if (info) {
                                arity = info.parameters.some((p) => p.isVariadic)
                                    ? undefined
                                    : info.parameters.length;
                                if (methodMap && arity !== undefined) {
                                    const g = buildCollisionGroups(methodMap);
                                    encTypeTag =
                                        typeTagForId(methodMap, funcName, arity, info, encLang, g) +
                                            constTagForId(methodMap, funcName, arity, info, g);
                                }
                            }
                        }
                    }
                }
                const arityTag = arity !== undefined ? `#${arity}${encTypeTag}` : '';
                const result = generateId(finalLabel, `${filePath}:${qualifiedName}${arityTag}`);
                functionIdCache.set(node, result);
                return result;
            }
        }
        if (provider.enclosingFunctionFinder) {
            const customResult = provider.enclosingFunctionFinder(current);
            if (customResult) {
                let finalLabel = customResult.label;
                if (provider.labelOverride) {
                    const override = provider.labelOverride(current.previousSibling, finalLabel);
                    if (override !== null)
                        finalLabel = override;
                }
                const classInfo = cachedFindEnclosingClassInfo(current.previousSibling ?? current, filePath, provider.resolveEnclosingOwner);
                const qualifiedName = classInfo
                    ? `${classInfo.className}.${customResult.funcName}`
                    : customResult.funcName;
                const sigNode = current.previousSibling ?? current;
                let arity2;
                let encTypeTag2 = '';
                if (finalLabel === 'Method' || finalLabel === 'Constructor') {
                    const encLang2 = getLanguageFromFilename(filePath);
                    const classNode2 = findEnclosingClassNode(sigNode) ?? findClassNodeByQualifiedName(sigNode);
                    if (classNode2 && encLang2) {
                        const methodMap2 = getMethodInfo(classNode2, provider, {
                            filePath,
                            language: encLang2,
                        });
                        const defLine2 = sigNode.startPosition.row + 1;
                        const info2 = methodMap2?.get(`${customResult.funcName}:${defLine2}`);
                        if (info2) {
                            arity2 = info2.parameters.some((p) => p.isVariadic)
                                ? undefined
                                : info2.parameters.length;
                            if (methodMap2 && arity2 !== undefined) {
                                const g2 = buildCollisionGroups(methodMap2);
                                encTypeTag2 =
                                    typeTagForId(methodMap2, customResult.funcName, arity2, info2, encLang2, g2) +
                                        constTagForId(methodMap2, customResult.funcName, arity2, info2, g2);
                            }
                        }
                    }
                }
                const arityTag2 = arity2 !== undefined ? `#${arity2}${encTypeTag2}` : '';
                const result = generateId(finalLabel, `${filePath}:${qualifiedName}${arityTag2}`);
                functionIdCache.set(node, result);
                return result;
            }
        }
        current = current.parent;
    }
    functionIdCache.set(node, null);
    return null;
};
export const cachedFindEnclosingClassInfo = (node, filePath, resolveEnclosingOwner) => {
    const cached = classIdCache.get(node);
    if (cached !== undefined)
        return cached;
    const result = findEnclosingClassInfo(node, filePath, resolveEnclosingOwner);
    classIdCache.set(node, result);
    return result;
};
export const cachedExportCheck = (checker, node, name) => {
    const cached = exportCache.get(node);
    if (cached !== undefined)
        return cached;
    const result = checker(node, name);
    exportCache.set(node, result);
    return result;
};
