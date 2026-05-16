import { parentPort } from 'node:worker_threads';
import { ParserProviderRegistry } from '../../../tree-sitter/ParserProviderRegistry.js';
import type { ParseResult } from '../../../tree-sitter/index.js';
import { SupportedLanguages, getLanguageFromFilename, type NodeLabel, type ParsedFile } from 'gitnexus-shared';
import { getProvider } from '../../languages/index.js';
import {
  getTreeSitterBufferSize,
  getTreeSitterContentByteLength,
  TREE_SITTER_MAX_BUFFER,
} from '../../constants.js';
import type { ExtractedHeritage } from '../../model/heritage-map.js';
import {
  getDefinitionNodeFromCaptures,
  getLabelFromCaptures,
  findDescendant,
  type SyntaxNode,
} from '../../utils/ast-helpers.js';
import { extractCallArgTypes } from '../../utils/call-analysis.js';
import { buildTypeEnv } from '../../type-env.js';
import { detectFrameworkFromAST } from '../../framework-detection.js';
import { generateId } from '../../utils/generate-id.js';
import { preprocessImportPath } from '../../import-processor.js';
import {
  extractVueScript,
  extractTemplateComponents,
  isVueSetupTopLevel,
} from '../../vue-sfc-extractor.js';
import type { FieldInfo, FieldExtractorContext } from '../../field-types.js';
import type { MethodInfo, MethodExtractorContext } from '../../method-types.js';
import type { VariableExtractorContext } from '../../variable-types.js';
import {
  buildMethodProps,
  arityForIdFromInfo,
  typeTagForId,
  constTagForId,
  buildCollisionGroups,
} from '../../utils/method-props.js';
import type { LanguageProvider } from '../../language-provider.js';
import { extractParsedFile } from '../../scope-extractor-bridge.js';
import { LoggerProviderRegistry } from '../../../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();
import type { SymbolTableReader } from '../../model/symbol-table.js';
import type { ParseWorkerInput, ParseWorkerResult } from './types.js';
import {
  clearCaches,
  findEnclosingFunctionId,
  cachedFindEnclosingClassInfo,
  cachedExportCheck,
  getFieldInfo,
  getMethodInfo,
  findEnclosingClassNode,
  findClassNodeByQualifiedName,
} from './helpers/cache.js';
import { extractLaravelRoutes } from './helpers/route-extractor.js';
import { extractORMQueries } from './helpers/orm.js';
import {
  ROUTE_DECORATOR_NAMES,
  HTTP_CLIENT_ONLY_METHODS,
  HTTP_CLIENT_RECEIVERS,
  EXPRESS_ROUTE_METHODS,
} from './constants.js';

const NOOP_SYMBOL_TABLE: SymbolTableReader = {
  lookupExact: () => undefined,
  lookupExactFull: () => undefined,
  lookupExactAll: () => [],
  lookupCallableByName: () => [],
  getFiles: () => [][Symbol.iterator](),
  getStats: () => ({ fileCount: 0 }),
};

const parserProvider = ParserProviderRegistry.get();

export const processFileGroup = async (
  files: ParseWorkerInput[],
  language: SupportedLanguages,
  queryString: string,
  result: ParseWorkerResult,
  onFileProcessed?: () => void,
): Promise<void> => {
  let query;
  try {
    query = parserProvider.createQuery(language, queryString);
  } catch (err) {
    const message = `Query compilation failed for ${language}: ${err instanceof Error ? err.message : String(err)}`;
    if (parentPort) {
      parentPort.postMessage({ type: 'warning', message });
    } else {
      logger.warn(message);
    }
    return;
  }

  for (const file of files) {
    if (getTreeSitterContentByteLength(file.content) > TREE_SITTER_MAX_BUFFER) continue;

    let parseContent = file.content;
    let lineOffset = 0;
    let isVueSetup = false;
    if (language === SupportedLanguages.Vue) {
      const extracted = extractVueScript(file.content);
      if (!extracted) continue;
      parseContent = extracted.scriptContent;
      lineOffset = extracted.lineOffset;
      isVueSetup = extracted.isSetup;
    }

    parseContent =
      getProvider(language).preprocessSource?.(parseContent, file.path) ?? parseContent;

    clearCaches();

    let parseResult: ParseResult;
    try {
      parseResult = await parserProvider.parse(parseContent, language);
    } catch (err) {
      logger.warn(
        `Failed to parse file ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    result.fileCount++;
    onFileProcessed?.();

    let matches;
    try {
      matches = query.matches(parseResult.rootNode);
    } catch (err) {
      logger.warn(
        `Query execution failed for ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const provider = getProvider(language);

    const parsedFile = extractParsedFile(
      provider,
      parseContent,
      file.path,
      (message) => {
        if (parentPort) parentPort.postMessage({ type: 'warning', message });
        else logger.warn(message);
      },
      parseResult.internal,
    );
    if (parsedFile !== undefined) result.parsedFiles.push(parsedFile);

    const fileParentMap = new Map<string, string[]>();
    if (provider.heritageExtractor) {
      for (const match of matches) {
        const captureMap: Record<string, SyntaxNode> = {};
        for (const c of match.captures) {
          captureMap[c.name] = c.node;
        }
        if (captureMap['heritage.class']) {
          const heritageItems = provider.heritageExtractor.extract(captureMap, {
            filePath: file.path,
            language,
          });
          for (const item of heritageItems) {
            if (item.kind === 'extends') {
              let parents = fileParentMap.get(item.className);
              if (!parents) {
                parents = [];
                fileParentMap.set(item.className, parents);
              }
              if (!parents.includes(item.parentName)) parents.push(item.parentName);
            }
          }
        }
      }
    }

    const parentMap: ReadonlyMap<string, readonly string[]> = fileParentMap;
    const typeEnv = buildTypeEnv(parseResult.internal as any, language, {
      parentMap,
      enclosingFunctionFinder: provider?.enclosingFunctionFinder,
      extractFunctionName: provider?.methodExtractor?.extractFunctionName,
    });
    const callRouter = provider.callRouter;

    if (typeEnv.constructorBindings.length > 0) {
      result.constructorBindings.push({
        filePath: file.path,
        bindings: [...typeEnv.constructorBindings],
      });
    }

    const fileScope = typeEnv.fileScope();
    if (fileScope.size > 0) {
      const scopeBindings: [string, string][] = [];
      for (const [varName, typeName] of fileScope) {
        scopeBindings.push([varName, typeName]);
      }
      result.fileScopeBindings.push({ filePath: file.path, bindings: scopeBindings });
    }

    const fileDecorators = new Map<number, { name: string; arg?: string; isTool?: boolean }>();
    const processedDefinitionNodes = new Set<number>();

    for (const match of matches) {
      const captureMap: Record<string, SyntaxNode> = {};
      for (const c of match.captures) {
        captureMap[c.name] = c.node;
      }

      if (captureMap['import'] && captureMap['import.source']) {
        const rawImportPath = preprocessImportPath(
          captureMap['import.source'].text,
          captureMap['import'],
          provider,
        );
        if (!rawImportPath) continue;
        const extractor = provider.namedBindingExtractor;
        const namedBindings = extractor ? extractor(captureMap['import']) : undefined;
        result.imports.push({
          filePath: file.path,
          rawImportPath,
          language: language,
          ...(namedBindings ? { namedBindings } : {}),
        });
        continue;
      }

      if (
        captureMap['assignment'] &&
        captureMap['assignment.receiver'] &&
        captureMap['assignment.property']
      ) {
        const receiverText = captureMap['assignment.receiver'].text;
        const propertyName = captureMap['assignment.property'].text;
        if (receiverText && propertyName) {
          const srcId =
            findEnclosingFunctionId(captureMap['assignment'], file.path, provider) ||
            generateId('File', file.path);
          let receiverTypeName: string | undefined;
          if (typeEnv) {
            receiverTypeName = typeEnv.lookup(receiverText, captureMap['assignment']) ?? undefined;
          }
          result.assignments.push({
            filePath: file.path,
            sourceId: srcId,
            receiverText,
            propertyName,
            ...(receiverTypeName ? { receiverTypeName } : {}),
          });
        }
        if (!captureMap['call']) continue;
      }

      if (captureMap['decorator'] && captureMap['decorator.name']) {
        const decoratorName = captureMap['decorator.name'].text;
        const decoratorArg = captureMap['decorator.arg']?.text;
        const decoratorNode = captureMap['decorator'];
        fileDecorators.set(decoratorNode.endPosition.row, {
          name: decoratorName,
          arg: decoratorArg,
        });

        if (ROUTE_DECORATOR_NAMES.has(decoratorName)) {
          const routePath = decoratorArg || '';
          const method = decoratorName.replace('Mapping', '').toUpperCase();
          const httpMethod = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
            ? method
            : 'GET';
          result.decoratorRoutes.push({
            filePath: file.path,
            routePath,
            httpMethod,
            decoratorName,
            lineNumber: decoratorNode.startPosition.row + lineOffset,
          });
        }
        if (decoratorName === 'tool') {
          fileDecorators.set(decoratorNode.endPosition.row, {
            name: decoratorName,
            arg: decoratorArg,
            isTool: true,
          });
        }
        continue;
      }

      if (captureMap['route.fetch']) {
        const urlNode = captureMap['route.url'] ?? captureMap['route.template_url'];
        if (urlNode) {
          result.fetchCalls.push({
            filePath: file.path,
            fetchURL: urlNode.text,
            lineNumber: captureMap['route.fetch'].startPosition.row + lineOffset,
          });
        }
        continue;
      }

      if (captureMap['http_client'] && captureMap['http_client.url']) {
        const method = captureMap['http_client.method']?.text;
        const url = captureMap['http_client.url'].text;
        if (method && HTTP_CLIENT_ONLY_METHODS.has(method) && url.startsWith('/')) {
          result.fetchCalls.push({
            filePath: file.path,
            fetchURL: url,
            lineNumber: captureMap['http_client'].startPosition.row + lineOffset,
          });
        }
        continue;
      }

      if (
        captureMap['express_route'] &&
        captureMap['express_route.method'] &&
        captureMap['express_route.path']
      ) {
        const method = captureMap['express_route.method'].text;
        const routePath = captureMap['express_route.path'].text;
        if (EXPRESS_ROUTE_METHODS.has(method) && routePath.startsWith('/')) {
          const callNode = captureMap['express_route'];
          const funcNode = callNode.childForFieldName?.('function') ?? callNode.children?.[0];
          let receiverNode = funcNode?.childForFieldName?.('object') ?? funcNode?.children?.[0];
          while (
            receiverNode?.type === 'member_expression' ||
            receiverNode?.type === 'call_expression'
          ) {
            if (receiverNode.type === 'member_expression') {
              const propNode = receiverNode.childForFieldName?.('property');
              if (propNode) {
                receiverNode = propNode;
              } else {
                break;
              }
            } else {
              const innerFunc =
                receiverNode.childForFieldName?.('function') ?? receiverNode.children?.[0];
              if (innerFunc && innerFunc !== receiverNode) {
                receiverNode = innerFunc;
              } else {
                break;
              }
            }
          }
          const receiverText = receiverNode?.text?.toLowerCase() ?? '';

          if (HTTP_CLIENT_RECEIVERS.has(receiverText)) {
            continue;
          }

          const httpMethod =
            method === 'all' || method === 'use' || method === 'route'
              ? 'GET'
              : method.toUpperCase();
          result.decoratorRoutes.push({
            filePath: file.path,
            routePath,
            httpMethod,
            decoratorName: `express.${method}`,
            lineNumber: captureMap['express_route'].startPosition.row + lineOffset,
          });
        }
        continue;
      }

      if (captureMap['call']) {
        const callNode = captureMap['call'];
        const callNameNode = captureMap['call.name'];
        const callExtractor = provider.callExtractor;

        if (callExtractor) {
          const langCallSite = callExtractor.extract(callNode, undefined);
          if (langCallSite) {
            if (!provider.isBuiltInName(langCallSite.calledName)) {
              const sourceId =
                findEnclosingFunctionId(callNode, file.path, provider) ||
                generateId('File', file.path);
              const receiverName =
                langCallSite.callForm === 'member' ? langCallSite.receiverName : undefined;
              let receiverTypeName = receiverName
                ? typeEnv.lookup(receiverName, callNode)
                : undefined;
              if (
                langCallSite.typeAsReceiverHeuristic &&
                receiverName !== undefined &&
                receiverTypeName === undefined &&
                langCallSite.callForm === 'member'
              ) {
                const c0 = receiverName.charCodeAt(0);
                if (c0 >= 65 && c0 <= 90) receiverTypeName = receiverName;
              }
              result.calls.push({
                filePath: file.path,
                calledName: langCallSite.calledName,
                sourceId,
                callForm: langCallSite.callForm,
                ...(receiverName !== undefined ? { receiverName } : {}),
                ...(receiverTypeName !== undefined ? { receiverTypeName } : {}),
              });
            }
            continue;
          }

          if (callNameNode) {
            const calledName = callNameNode.text;

            if (provider.heritageExtractor?.extractFromCall) {
              const heritageItems = provider.heritageExtractor.extractFromCall(
                calledName,
                callNode,
                { filePath: file.path, language },
              );
              if (heritageItems !== null) {
                for (const item of heritageItems) {
                  result.heritage.push({
                    filePath: file.path,
                    className: item.className,
                    parentName: item.parentName,
                    kind: item.kind,
                  });
                }
                continue;
              }
            }

            const routed = callRouter?.(calledName, captureMap['call']);
            if (routed) {
              if (routed.kind === 'skip') continue;

              if (routed.kind === 'import') {
                result.imports.push({
                  filePath: file.path,
                  rawImportPath: routed.importPath,
                  language,
                });
                continue;
              }

              if (routed.kind === 'properties') {
                const propEnclosingInfo = cachedFindEnclosingClassInfo(
                  captureMap['call'],
                  file.path,
                  provider.resolveEnclosingOwner,
                );
                const propEnclosingClassId = propEnclosingInfo?.classId ?? null;
                let routedFieldMap: Map<string, FieldInfo> | undefined;
                if (provider.fieldExtractor && typeEnv) {
                  const classNode = findEnclosingClassNode(captureMap['call']);
                  if (classNode) {
                    routedFieldMap = getFieldInfo(classNode, provider, {
                      typeEnv,
                      symbolTable: NOOP_SYMBOL_TABLE,
                      filePath: file.path,
                      language,
                    });
                  }
                }
                for (const item of routed.items) {
                  const routedFieldInfo = routedFieldMap?.get(item.propName);
                  const propQualifiedName = propEnclosingInfo
                    ? `${propEnclosingInfo.className}.${item.propName}`
                    : item.propName;
                  const nodeId = generateId('Property', `${file.path}:${propQualifiedName}`);
                  result.nodes.push({
                    id: nodeId,
                    label: 'Property',
                    properties: {
                      name: item.propName,
                      filePath: file.path,
                      startLine: item.startLine,
                      endLine: item.endLine,
                      language,
                      isExported: true,
                      description: item.accessorType,
                      ...(item.declaredType
                        ? { declaredType: item.declaredType }
                        : routedFieldInfo?.type
                          ? { declaredType: routedFieldInfo.type }
                          : {}),
                      ...(routedFieldInfo?.visibility !== undefined
                        ? { visibility: routedFieldInfo.visibility }
                        : {}),
                      ...(routedFieldInfo?.isStatic !== undefined
                        ? { isStatic: routedFieldInfo.isStatic }
                        : {}),
                      ...(routedFieldInfo?.isReadonly !== undefined
                        ? { isReadonly: routedFieldInfo.isReadonly }
                        : {}),
                    },
                  });
                  result.symbols.push({
                    filePath: file.path,
                    name: item.propName,
                    nodeId,
                    type: 'Property',
                    ...(propEnclosingClassId ? { ownerId: propEnclosingClassId } : {}),
                    ...(item.declaredType
                      ? { declaredType: item.declaredType }
                      : routedFieldInfo?.type
                        ? { declaredType: routedFieldInfo.type }
                        : {}),
                    ...(routedFieldInfo?.visibility !== undefined
                      ? { visibility: routedFieldInfo.visibility }
                      : {}),
                    ...(routedFieldInfo?.isStatic !== undefined
                      ? { isStatic: routedFieldInfo.isStatic }
                      : {}),
                    ...(routedFieldInfo?.isReadonly !== undefined
                      ? { isReadonly: routedFieldInfo.isReadonly }
                      : {}),
                  });
                  const fileId = generateId('File', file.path);
                  const relId = generateId('DEFINES', `${fileId}->${nodeId}`);
                  result.relationships.push({
                    id: relId,
                    sourceId: fileId,
                    targetId: nodeId,
                    type: 'DEFINES',
                    confidence: 1.0,
                    reason: '',
                  });
                  if (propEnclosingClassId) {
                    result.relationships.push({
                      id: generateId('HAS_PROPERTY', `${propEnclosingClassId}->${nodeId}`),
                      sourceId: propEnclosingClassId,
                      targetId: nodeId,
                      type: 'HAS_PROPERTY',
                      confidence: 1.0,
                      reason: '',
                    });
                  }
                }
                continue;
              }
            }

            if (!provider.isBuiltInName(calledName)) {
              const callSite = callExtractor.extract(callNode, callNameNode);
              if (callSite) {
                const sourceId =
                  findEnclosingFunctionId(callNode, file.path, provider) ||
                  generateId('File', file.path);
                let receiverTypeName = callSite.receiverName
                  ? typeEnv.lookup(callSite.receiverName, callNode)
                  : undefined;

                if (
                  callSite.typeAsReceiverHeuristic &&
                  callSite.receiverName !== undefined &&
                  receiverTypeName === undefined &&
                  callSite.callForm === 'member'
                ) {
                  const c0 = callSite.receiverName.charCodeAt(0);
                  if (c0 >= 65 && c0 <= 90) receiverTypeName = callSite.receiverName;
                }

                const inferLiteralType = provider.typeConfig?.inferLiteralType;
                const argTypes =
                  inferLiteralType && callSite.argCount !== undefined && callSite.argCount > 0
                    ? extractCallArgTypes(callNode, inferLiteralType, (varName, cn) =>
                        typeEnv.lookup(varName, cn),
                      )
                    : undefined;

                result.calls.push({
                  filePath: file.path,
                  calledName: callSite.calledName,
                  sourceId,
                  ...(callSite.argCount !== undefined ? { argCount: callSite.argCount } : {}),
                  ...(callSite.callForm !== undefined ? { callForm: callSite.callForm } : {}),
                  ...(callSite.receiverName !== undefined
                    ? { receiverName: callSite.receiverName }
                    : {}),
                  ...(receiverTypeName !== undefined ? { receiverTypeName } : {}),
                  ...(callSite.receiverMixedChain !== undefined
                    ? { receiverMixedChain: callSite.receiverMixedChain }
                    : {}),
                  ...(argTypes !== undefined ? { argTypes } : {}),
                });
              }
            }
          }
        }
        continue;
      }

      if (captureMap['heritage.class']) {
        if (provider.heritageExtractor) {
          const heritageItems = provider.heritageExtractor.extract(captureMap, {
            filePath: file.path,
            language,
          });
          for (const item of heritageItems) {
            result.heritage.push({
              filePath: file.path,
              className: item.className,
              parentName: item.parentName,
              kind: item.kind,
            });
          }
          if (heritageItems.length > 0) {
            continue;
          }
        }
        if (
          captureMap['heritage.extends'] ||
          captureMap['heritage.implements'] ||
          captureMap['heritage.trait']
        ) {
          continue;
        }
      }

      const definitionNode = getDefinitionNodeFromCaptures(captureMap);
      const defaultNodeLabel = getLabelFromCaptures(captureMap, provider);
      if (!defaultNodeLabel) continue;

      const nameNode = captureMap['name'];
      const extractedClassSymbol =
        definitionNode && provider.classExtractor?.isTypeDeclaration(definitionNode)
          ? provider.classExtractor.extract(definitionNode, {
              name: nameNode?.text,
              type: defaultNodeLabel,
            })
          : null;
      const nodeLabel = extractedClassSymbol?.type ?? defaultNodeLabel;

      if (
        (nodeLabel === 'Const' || nodeLabel === 'Static' || nodeLabel === 'Variable') &&
        definitionNode &&
        processedDefinitionNodes.has(definitionNode.startIndex)
      ) {
        continue;
      }
      if (definitionNode) {
        processedDefinitionNodes.add(definitionNode.startIndex);
      }

      if (!nameNode && nodeLabel !== 'Constructor' && !extractedClassSymbol) continue;
      const nodeName = extractedClassSymbol?.name ?? (nameNode ? nameNode.text : 'init');
      const startLine = definitionNode
        ? definitionNode.startPosition.row + lineOffset
        : nameNode
          ? nameNode.startPosition.row + lineOffset
          : lineOffset;

      const needsOwner =
        nodeLabel === 'Method' ||
        nodeLabel === 'Constructor' ||
        nodeLabel === 'Property' ||
        nodeLabel === 'Function';
      const enclosingClassInfo = needsOwner
        ? cachedFindEnclosingClassInfo(
            nameNode || definitionNode,
            file.path,
            provider.resolveEnclosingOwner,
          )
        : null;
      const enclosingClassId = enclosingClassInfo?.classId ?? null;

      const qualifiedName = enclosingClassInfo
        ? `${enclosingClassInfo.className}.${nodeName}`
        : nodeName;

      let declaredType: string | undefined;
      let methodProps: Record<string, unknown> = {};
      let arityForId: number | undefined;
      let defMethodMap: Map<string, MethodInfo> | undefined;
      let defMethodInfo: MethodInfo | undefined;
      if (nodeLabel === 'Function' || nodeLabel === 'Method' || nodeLabel === 'Constructor') {
        let enrichedByMethodExtractor = false;
        if (provider.methodExtractor && definitionNode) {
          const classNode =
            findEnclosingClassNode(definitionNode) ?? findClassNodeByQualifiedName(definitionNode);
          if (classNode) {
            const methodMap = getMethodInfo(classNode, provider, {
              filePath: file.path,
              language,
            });
            const defLine = definitionNode.startPosition.row + 1;
            const info = methodMap?.get(`${nodeName}:${defLine}`);
            if (info) {
              enrichedByMethodExtractor = true;
              arityForId = arityForIdFromInfo(info);
              methodProps = buildMethodProps(info);
              defMethodMap = methodMap;
              defMethodInfo = info;
            }
          }
        }

        if (
          !enrichedByMethodExtractor &&
          provider.methodExtractor?.extractFromNode &&
          definitionNode
        ) {
          const info = provider.methodExtractor.extractFromNode(definitionNode, {
            filePath: file.path,
            language,
          });
          if (info) {
            enrichedByMethodExtractor = true;
            arityForId = arityForIdFromInfo(info);
            methodProps = buildMethodProps(info);
          }
        }
      }

      const needsAritySuffix =
        nodeLabel === 'Method' ||
        nodeLabel === 'Constructor' ||
        (nodeLabel === 'Function' && enclosingClassId !== null);
      let arityTag = needsAritySuffix && arityForId !== undefined ? `#${arityForId}` : '';
      if (arityTag && defMethodMap && defMethodInfo) {
        const groups = buildCollisionGroups(defMethodMap);
        arityTag += typeTagForId(
          defMethodMap,
          nodeName,
          arityForId,
          defMethodInfo,
          language,
          groups,
        );
        arityTag += constTagForId(defMethodMap, nodeName, arityForId, defMethodInfo, groups);
      }
      const nodeId = generateId(nodeLabel, `${file.path}:${qualifiedName}${arityTag}`);
      const classNodeForSymbol = definitionNode || nameNode;
      const qualifiedTypeName =
        extractedClassSymbol?.qualifiedName ??
        (classNodeForSymbol && provider.classExtractor?.isTypeDeclaration(classNodeForSymbol)
          ? (provider.classExtractor.extractQualifiedName(classNodeForSymbol, nodeName) ?? nodeName)
          : undefined);

      const description = provider.descriptionExtractor?.(nodeLabel, nodeName, captureMap);

      let frameworkHint = definitionNode
        ? detectFrameworkFromAST(language, (definitionNode.text || '').slice(0, 300))
        : null;

      if (frameworkHint && definitionNode) {
        let classCheck = definitionNode.parent;
        while (classCheck) {
          if (classCheck.type === 'interface_declaration') {
            frameworkHint = null;
            break;
          }
          if (classCheck.type === 'class_declaration' || classCheck.type === 'program') {
            break;
          }
          classCheck = classCheck.parent;
        }
      }

      const MAX_DECORATOR_SCAN_LINES = 5;
      if (definitionNode) {
        const defStartLine = definitionNode.startPosition.row;
        for (
          let checkLine = defStartLine - 1;
          checkLine >= Math.max(0, defStartLine - MAX_DECORATOR_SCAN_LINES);
          checkLine--
        ) {
          const dec = fileDecorators.get(checkLine);
          if (dec) {
            if (!frameworkHint) {
              frameworkHint = {
                framework: 'decorator',
                entryPointMultiplier: 1.2,
                reason: `@${dec.name}${dec.arg ? `("${dec.arg}")` : ''}`,
              };
            }
            if (dec.isTool) {
              result.toolDefs.push({
                filePath: file.path,
                toolName: nodeName,
                description: (dec.arg || description || '').slice(0, 200),
                lineNumber: definitionNode.startPosition.row + lineOffset,
                handlerNodeId: nodeId,
              });
            }
            fileDecorators.delete(checkLine);
          }
        }
      }

      if (nodeLabel === 'Property' && definitionNode) {
        if (provider.fieldExtractor && typeEnv) {
          const classNode = findEnclosingClassNode(definitionNode);
          if (classNode) {
            const fieldMap = getFieldInfo(classNode, provider, {
              typeEnv,
              symbolTable: NOOP_SYMBOL_TABLE,
              filePath: file.path,
              language,
            });
            const info = fieldMap?.get(nodeName);
            if (info) {
              declaredType = info.type ?? undefined;
              methodProps.visibility = info.visibility;
              methodProps.isStatic = info.isStatic;
              methodProps.isReadonly = info.isReadonly;
            }
          }
        }
      }

      if (
        (nodeLabel === 'Const' || nodeLabel === 'Static' || nodeLabel === 'Variable') &&
        definitionNode &&
        provider.variableExtractor
      ) {
        const varCtx: VariableExtractorContext = {
          filePath: file.path,
          language,
        };
        const varInfo = provider.variableExtractor.extract(definitionNode, varCtx);
        if (varInfo) {
          if (varInfo.type) declaredType = varInfo.type;
          methodProps.visibility = varInfo.visibility;
          methodProps.isStatic = varInfo.isStatic;
          methodProps.isConst = varInfo.isConst;
          methodProps.isMutable = varInfo.isMutable;
          methodProps.scope = varInfo.scope;
        }
      }

      result.nodes.push({
        id: nodeId,
        label: nodeLabel,
        properties: {
          name: nodeName,
          filePath: file.path,
          startLine: definitionNode ? definitionNode.startPosition.row + lineOffset : startLine,
          endLine: definitionNode ? definitionNode.endPosition.row + lineOffset : startLine,
          language: language,
          isExported:
            language === SupportedLanguages.Vue && isVueSetup
              ? isVueSetupTopLevel(nameNode || definitionNode)
              : cachedExportCheck(provider.exportChecker, nameNode || definitionNode, nodeName),
          ...(qualifiedTypeName !== undefined ? { qualifiedName: qualifiedTypeName } : {}),
          ...(frameworkHint
            ? {
                astFrameworkMultiplier: frameworkHint.entryPointMultiplier,
                astFrameworkReason: frameworkHint.reason,
              }
            : {}),
          ...(description !== undefined ? { description } : {}),
          ...methodProps,
          ...(declaredType !== undefined ? { declaredType } : {}),
        },
      });

      result.symbols.push({
        filePath: file.path,
        name: nodeName,
        nodeId,
        type: nodeLabel,
        ...(qualifiedTypeName !== undefined ? { qualifiedName: qualifiedTypeName } : {}),
        parameterCount: methodProps.parameterCount as number | undefined,
        requiredParameterCount: methodProps.requiredParameterCount as number | undefined,
        parameterTypes: methodProps.parameterTypes as string[] | undefined,
        returnType: methodProps.returnType as string | undefined,
        ...(declaredType !== undefined ? { declaredType } : {}),
        ...(enclosingClassId ? { ownerId: enclosingClassId } : {}),
        visibility: methodProps.visibility as string | undefined,
        isStatic: methodProps.isStatic as boolean | undefined,
        isReadonly: methodProps.isReadonly as boolean | undefined,
        isAbstract: methodProps.isAbstract as boolean | undefined,
        isFinal: methodProps.isFinal as boolean | undefined,
        ...(methodProps.isVirtual !== undefined
          ? { isVirtual: methodProps.isVirtual as boolean }
          : {}),
        ...(methodProps.isOverride !== undefined
          ? { isOverride: methodProps.isOverride as boolean }
          : {}),
        ...(methodProps.isAsync !== undefined ? { isAsync: methodProps.isAsync as boolean } : {}),
        ...(methodProps.isPartial !== undefined
          ? { isPartial: methodProps.isPartial as boolean }
          : {}),
        ...(methodProps.annotations !== undefined
          ? { annotations: methodProps.annotations as string[] }
          : {}),
      });

      const fileId = generateId('File', file.path);
      const relId = generateId('DEFINES', `${fileId}->${nodeId}`);
      result.relationships.push({
        id: relId,
        sourceId: fileId,
        targetId: nodeId,
        type: 'DEFINES',
        confidence: 1.0,
        reason: '',
      });

      if (enclosingClassId) {
        const memberEdgeType = nodeLabel === 'Property' ? 'HAS_PROPERTY' : 'HAS_METHOD';
        result.relationships.push({
          id: generateId(memberEdgeType, `${enclosingClassId}->${nodeId}`),
          sourceId: enclosingClassId,
          targetId: nodeId,
          type: memberEdgeType,
          confidence: 1.0,
          reason: '',
        });
      }
    }

    if (provider.isRouteFile?.(file.path)) {
      const extractedRoutes = extractLaravelRoutes(parseResult.internal as any, file.path);
      for (const r of extractedRoutes) result.routes.push(r);
    }

    extractORMQueries(file.path, parseContent, result.ormQueries);

    if (language === SupportedLanguages.Vue) {
      const templateComponents = extractTemplateComponents(file.content);
      for (const componentName of templateComponents) {
        result.calls.push({
          filePath: file.path,
          calledName: componentName,
          sourceId: generateId('File', file.path),
          callForm: 'free',
        });
      }
    }
  }
};
