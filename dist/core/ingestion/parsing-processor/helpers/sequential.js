import { Query as WtsQuery } from 'web-tree-sitter';
import { loadParser, loadLanguage, isLanguageAvailable } from '../../../tree-sitter/parser-loader.js';
import { getProvider } from '../../languages/index.js';
import { generateId } from '../../../../lib/utils.js';
import { getLanguageFromFilename, SupportedLanguages } from '../../../../_shared/index.js';
import { extractVueScript, isVueSetupTopLevel } from '../../vue-sfc-extractor.js';
import { yieldToEventLoop } from '../../utils/event-loop.js';
import { isVerboseIngestionEnabled } from '../../utils/verbose.js';
import { getDefinitionNodeFromCaptures, findEnclosingClassInfo, getLabelFromCaptures, CLASS_CONTAINER_TYPES, } from '../../utils/ast-helpers.js';
import { detectFrameworkFromAST } from '../../framework-detection.js';
import { buildTypeEnv } from '../../type-env.js';
import { buildMethodProps, arityForIdFromInfo, typeTagForId, constTagForId, buildCollisionGroups, } from '../../utils/method-props.js';
import { logger } from '../../../logger.js';
import { getTreeSitterContentByteLength, TREE_SITTER_MAX_BUFFER, } from '../../constants.js';
const classInfoCache = new Map();
const exportCache = new Map();
const cachedFindEnclosingClassInfo = (node, filePath, resolveEnclosingOwner) => {
    const cached = classInfoCache.get(node);
    if (cached !== undefined)
        return cached;
    const result = findEnclosingClassInfo(node, filePath, resolveEnclosingOwner);
    classInfoCache.set(node, result);
    return result;
};
const cachedExportCheck = (checker, node, name) => {
    const cached = exportCache.get(node);
    if (cached !== undefined)
        return cached;
    const result = checker(node, name);
    exportCache.set(node, result);
    return result;
};
const seqFieldInfoCache = new Map();
const seqMethodExtractCache = new Map();
const seqMethodMapCache = new Map();
function seqFindEnclosingOwnerNode(node, resolveEnclosingOwner) {
    let current = node.parent;
    while (current) {
        if (CLASS_CONTAINER_TYPES.has(current.type)) {
            if (resolveEnclosingOwner) {
                const resolved = resolveEnclosingOwner(current);
                if (resolved === null) {
                    current = current.parent;
                    continue;
                }
                return resolved;
            }
            return current;
        }
        current = current.parent;
    }
    return null;
}
const NOOP_SYMBOL_TABLE_SEQ = {
    lookupExact: () => undefined,
    lookupExactFull: () => undefined,
    lookupExactAll: () => [],
    lookupCallableByName: () => [],
    getFiles: () => [][Symbol.iterator](),
    getStats: () => ({ fileCount: 0 }),
};
function seqGetFieldInfo(classNode, provider, context) {
    if (!provider.fieldExtractor)
        return undefined;
    const cacheKey = classNode.startIndex;
    let cached = seqFieldInfoCache.get(cacheKey);
    if (cached)
        return cached;
    const extracted = provider.fieldExtractor.extract(classNode, context);
    if (!extracted?.fields?.length)
        return undefined;
    cached = new Map();
    for (const field of extracted.fields)
        cached.set(field.name, field);
    seqFieldInfoCache.set(cacheKey, cached);
    return cached;
}
const processParsingSequential = async (graph, files, symbolTable, astCache, scopeTreeCache, onFileProgress) => {
    const parser = await loadParser();
    const total = files.length;
    const logSkipped = isVerboseIngestionEnabled();
    const skippedByLang = logSkipped ? new Map() : null;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        classInfoCache.clear();
        exportCache.clear();
        seqFieldInfoCache.clear();
        seqMethodExtractCache.clear();
        seqMethodMapCache.clear();
        onFileProgress?.(i + 1, total, file.path);
        if (i % 20 === 0)
            await yieldToEventLoop();
        const language = getLanguageFromFilename(file.path);
        if (!language)
            continue;
        if (!isLanguageAvailable(language)) {
            if (skippedByLang) {
                skippedByLang.set(language, (skippedByLang.get(language) ?? 0) + 1);
            }
            continue;
        }
        if (getTreeSitterContentByteLength(file.content) > TREE_SITTER_MAX_BUFFER)
            continue;
        let parseContent = file.content;
        let lineOffset = 0;
        let isVueSetup = false;
        if (language === SupportedLanguages.Vue) {
            const extracted = extractVueScript(file.content);
            if (!extracted)
                continue;
            parseContent = extracted.scriptContent;
            lineOffset = extracted.lineOffset;
            isVueSetup = extracted.isSetup;
        }
        parseContent =
            getProvider(language).preprocessSource?.(parseContent, file.path) ?? parseContent;
        try {
            await loadLanguage(language, file.path);
        }
        catch {
            continue;
        }
        let tree;
        try {
            tree = parser.parse(parseContent, undefined);
        }
        catch (parseError) {
            logger.warn(`Skipping unparseable file: ${file.path}`);
            continue;
        }
        astCache.set(file.path, tree);
        const provider = getProvider(language);
        if (provider.emitScopeCaptures !== undefined) {
            scopeTreeCache?.set(file.path, tree);
        }
        const queryString = provider.treeSitterQueries;
        if (!queryString) {
            continue;
        }
        let query;
        let matches;
        try {
            const language = parser.language;
            query = new WtsQuery(language, queryString);
            matches = query.matches(tree.rootNode);
        }
        catch (queryError) {
            logger.warn({ queryError }, `Query error for ${file.path}:`);
            continue;
        }
        const typeEnv = provider.fieldExtractor
            ? buildTypeEnv(tree, language, {
                enclosingFunctionFinder: provider.enclosingFunctionFinder,
                extractFunctionName: provider.methodExtractor?.extractFunctionName,
            })
            : null;
        matches.forEach((match) => {
            const captureMap = {};
            match.captures.forEach((c) => {
                captureMap[c.name] = c.node;
            });
            const definitionNodeForRange = getDefinitionNodeFromCaptures(captureMap);
            const definitionNode = getDefinitionNodeFromCaptures(captureMap);
            const defaultNodeLabel = getLabelFromCaptures(captureMap, provider);
            if (!defaultNodeLabel)
                return;
            const nameNode = captureMap['name'];
            const extractedClassSymbol = definitionNode && provider.classExtractor?.isTypeDeclaration(definitionNode)
                ? provider.classExtractor.extract(definitionNode, {
                    name: nameNode?.text,
                    type: defaultNodeLabel,
                })
                : null;
            const nodeLabel = extractedClassSymbol?.type ?? defaultNodeLabel;
            if (!nameNode && nodeLabel !== 'Constructor' && !extractedClassSymbol)
                return;
            const nodeName = extractedClassSymbol?.name ?? (nameNode ? nameNode.text : 'init');
            const startLine = definitionNodeForRange
                ? definitionNodeForRange.startPosition.row + lineOffset
                : nameNode
                    ? nameNode.startPosition.row + lineOffset
                    : lineOffset;
            const needsOwner = nodeLabel === 'Method' ||
                nodeLabel === 'Constructor' ||
                nodeLabel === 'Property' ||
                nodeLabel === 'Function';
            const enclosingClassInfo = needsOwner
                ? cachedFindEnclosingClassInfo(nameNode || definitionNodeForRange, file.path, provider.resolveEnclosingOwner)
                : null;
            const enclosingClassId = enclosingClassInfo?.classId ?? null;
            const qualifiedName = enclosingClassInfo
                ? `${enclosingClassInfo.className}.${nodeName}`
                : nodeName;
            const isMethodLike = nodeLabel === 'Function' || nodeLabel === 'Method' || nodeLabel === 'Constructor';
            let methodProps = {};
            let arityForId;
            let seqDefMethodInfo;
            let seqDefMethods;
            let seqClassNodeId;
            if (isMethodLike && definitionNode) {
                let enriched = false;
                if (provider.methodExtractor) {
                    const methodOwnerNode = seqFindEnclosingOwnerNode(definitionNode);
                    if (methodOwnerNode) {
                        let result = seqMethodExtractCache.get(methodOwnerNode.id);
                        if (result === undefined) {
                            result =
                                provider.methodExtractor.extract(methodOwnerNode, {
                                    filePath: file.path,
                                    language,
                                }) ?? null;
                            seqMethodExtractCache.set(methodOwnerNode.id, result);
                        }
                        if (result?.methods?.length) {
                            const defLine = definitionNode.startPosition.row + 1;
                            const info = result.methods.find((m) => m.name === nodeName && m.line === defLine);
                            if (info) {
                                enriched = true;
                                arityForId = arityForIdFromInfo(info);
                                methodProps = buildMethodProps(info);
                                seqDefMethodInfo = info;
                                seqDefMethods = result.methods;
                                seqClassNodeId = methodOwnerNode.id;
                            }
                        }
                    }
                    if (!enriched && provider.methodExtractor.extractFromNode) {
                        const info = provider.methodExtractor.extractFromNode(definitionNode, {
                            filePath: file.path,
                            language,
                        });
                        if (info) {
                            enriched = true;
                            arityForId = arityForIdFromInfo(info);
                            methodProps = buildMethodProps(info);
                        }
                    }
                }
            }
            const needsAritySuffix = nodeLabel === 'Method' ||
                nodeLabel === 'Constructor' ||
                (nodeLabel === 'Function' && enclosingClassId !== null);
            let arityTag = needsAritySuffix && arityForId !== undefined ? `#${arityForId}` : '';
            if (arityTag && seqDefMethods && seqDefMethodInfo && seqClassNodeId !== undefined) {
                let cached = seqMethodMapCache.get(seqClassNodeId);
                if (!cached) {
                    const tempMap = new Map();
                    for (const m of seqDefMethods)
                        tempMap.set(`${m.name}:${m.line}`, m);
                    cached = { map: tempMap, groups: buildCollisionGroups(tempMap) };
                    seqMethodMapCache.set(seqClassNodeId, cached);
                }
                arityTag += typeTagForId(cached.map, nodeName, arityForId, seqDefMethodInfo, language, cached.groups);
                arityTag += constTagForId(cached.map, nodeName, arityForId, seqDefMethodInfo, cached.groups);
            }
            const nodeId = generateId(nodeLabel, `${file.path}:${qualifiedName}${arityTag}`);
            const classNodeForSymbol = definitionNodeForRange || definitionNode || nameNode;
            const qualifiedTypeName = extractedClassSymbol?.qualifiedName ??
                (classNodeForSymbol && provider.classExtractor?.isTypeDeclaration(classNodeForSymbol)
                    ? (provider.classExtractor.extractQualifiedName(classNodeForSymbol, nodeName) ?? nodeName)
                    : undefined);
            const frameworkHint = definitionNode
                ? detectFrameworkFromAST(language, (definitionNode.text || '').slice(0, 300))
                : null;
            const node = {
                id: nodeId,
                label: nodeLabel,
                properties: {
                    name: nodeName,
                    filePath: file.path,
                    startLine: definitionNodeForRange
                        ? definitionNodeForRange.startPosition.row + lineOffset
                        : startLine,
                    endLine: definitionNodeForRange
                        ? definitionNodeForRange.endPosition.row + lineOffset
                        : startLine,
                    language: language,
                    isExported: language === SupportedLanguages.Vue && isVueSetup
                        ? isVueSetupTopLevel(nameNode || definitionNodeForRange)
                        : cachedExportCheck(provider.exportChecker, nameNode || definitionNodeForRange, nodeName),
                    ...(qualifiedTypeName !== undefined ? { qualifiedName: qualifiedTypeName } : {}),
                    ...(frameworkHint
                        ? {
                            astFrameworkMultiplier: frameworkHint.entryPointMultiplier,
                            astFrameworkReason: frameworkHint.reason,
                        }
                        : {}),
                    ...methodProps,
                },
            };
            graph.addNode(node);
            let declaredType;
            let seqVisibility;
            let seqIsStatic;
            let seqIsReadonly;
            if (nodeLabel === 'Property' && definitionNode) {
                if (provider.fieldExtractor && typeEnv) {
                    const classNode = seqFindEnclosingOwnerNode(definitionNode, provider.resolveEnclosingOwner);
                    if (classNode) {
                        const fieldMap = seqGetFieldInfo(classNode, provider, {
                            typeEnv,
                            symbolTable: NOOP_SYMBOL_TABLE_SEQ,
                            filePath: file.path,
                            language,
                        });
                        const info = fieldMap?.get(nodeName);
                        if (info) {
                            declaredType = info.type ?? undefined;
                            seqVisibility = info.visibility;
                            seqIsStatic = info.isStatic;
                            seqIsReadonly = info.isReadonly;
                        }
                    }
                }
            }
            if (seqVisibility !== undefined)
                node.properties.visibility = seqVisibility;
            if (seqIsStatic !== undefined)
                node.properties.isStatic = seqIsStatic;
            if (seqIsReadonly !== undefined)
                node.properties.isReadonly = seqIsReadonly;
            if (declaredType !== undefined)
                node.properties.declaredType = declaredType;
            symbolTable.add(file.path, nodeName, nodeId, nodeLabel, {
                parameterCount: methodProps.parameterCount,
                requiredParameterCount: methodProps.requiredParameterCount,
                parameterTypes: methodProps.parameterTypes,
                returnType: methodProps.returnType,
                declaredType,
                ownerId: enclosingClassId ?? undefined,
                qualifiedName: qualifiedTypeName,
            });
            const fileId = generateId('File', file.path);
            const relId = generateId('DEFINES', `${fileId}->${nodeId}`);
            const relationship = {
                id: relId,
                sourceId: fileId,
                targetId: nodeId,
                type: 'DEFINES',
                confidence: 1.0,
                reason: '',
            };
            graph.addRelationship(relationship);
            if (enclosingClassId) {
                const memberEdgeType = nodeLabel === 'Property' ? 'HAS_PROPERTY' : 'HAS_METHOD';
                graph.addRelationship({
                    id: generateId(memberEdgeType, `${enclosingClassId}->${nodeId}`),
                    sourceId: enclosingClassId,
                    targetId: nodeId,
                    type: memberEdgeType,
                    confidence: 1.0,
                    reason: '',
                });
            }
        });
    }
    if (skippedByLang && skippedByLang.size > 0) {
        for (const [lang, count] of skippedByLang.entries()) {
            logger.warn(`[ingestion] Skipped ${count} ${lang} file(s) in parsing processing — ${lang} parser not available.`);
        }
    }
};
export { processParsingSequential };
