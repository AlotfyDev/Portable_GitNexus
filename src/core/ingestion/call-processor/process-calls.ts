import { KnowledgeGraph } from '../../graph/types.js';
import { ASTCache } from '../ast-cache.js';
import type { ExtractedHeritage } from '../model/index.js';
import type { DispatchDecision, ReceiverEnriched } from '../call-types.js';
import type { ExportedTypeMap } from './types.js';
import { CLASS_LIKE_TYPES } from './constants.js';

import { ParserProviderRegistry } from '../../tree-sitter/ParserProviderRegistry.js';
import type { ParserQueryMatch } from '../../tree-sitter/index.js';
import type { ResolutionContext } from '../model/resolution-context.js';
import { getProvider } from '../languages/index.js';
import { generateId } from '../utils/generate-id.js';
import { getLanguageFromFilename, SupportedLanguages } from 'gitnexus-shared';
import { isRegistryPrimary } from '../registry-primary-flag.js';
import { isVerboseIngestionEnabled } from '../utils/verbose.js';
import { yieldToEventLoop } from '../utils/event-loop.js';
import {
  FUNCTION_NODE_TYPES,
  findEnclosingClassId,
  genericFuncName,
} from '../utils/ast-helpers.js';
import {
  countCallArguments,
  inferCallForm,
  extractReceiverName,
  extractReceiverNode,
  extractMixedChain,
} from '../utils/call-analysis.js';
import { buildTypeEnv, isSubclassOf } from '../type-env.js';
import type { BindingAccumulator } from '../binding-accumulator.js';
import { extractTemplateComponents } from '../vue-sfc-extractor.js';
import type { SyntaxNode } from '../utils/ast-helpers.js';

import { LoggerProviderRegistry } from '../../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();
import { enclosingFnExtractCache, findEnclosingFunction } from './helpers/enclosing-function.js';
import { verifyConstructorBindings } from './helpers/constructor-verifier.js';
import {
  buildReceiverTypeIndex,
  lookupReceiverType,
  resolveFieldAccessType,
  resolveFieldOwnership,
} from './helpers/receiver-resolution.js';
import { resolveCallTarget, extractFuncNameFromSourceId } from './helpers/resolve-call-target.js';
import { findInterfaceDispatchTargets } from './helpers/interface-dispatch.js';
import { walkMixedChain } from './helpers/mixed-chain.js';
import { makeAccessEmitter } from './helpers/access-emitter.js';
import { collectExportedBindings } from './helpers/exported-types.js';
import { defaultDispatchDecision } from './default-dispatch.js';

const parserProvider = ParserProviderRegistry.get();

/** Shorthand for the receiver-source discriminant shared across the DAG. */
type ReceiverSource = ReceiverEnriched['receiverSource'];

/** Per-file cache for module-alias widening. Cleared between files. */
type WidenCache = Map<string, readonly import('gitnexus-shared').SymbolDefinition[]>;

// FREE_CALLABLE_TYPES imported from symbol-table.ts — single source of truth.
// Re-exported for backward compatibility from barrel.

export const processCalls = async (
  graph: KnowledgeGraph,
  files: { path: string; content: string }[],
  astCache: ASTCache,
  ctx: ResolutionContext,
  onProgress?: (current: number, total: number) => void,
  exportedTypeMap?: ExportedTypeMap,
  importedBindingsMap?: ReadonlyMap<string, ReadonlyMap<string, string>>,
  importedReturnTypesMap?: ReadonlyMap<string, ReadonlyMap<string, string>>,
  importedRawReturnTypesMap?: ReadonlyMap<string, ReadonlyMap<string, string>>,
  heritageMap?: import('../model/index.js').HeritageMap,
  bindingAccumulator?: BindingAccumulator,
): Promise<ExtractedHeritage[]> => {
  const collectedHeritage: ExtractedHeritage[] = [];
  const pendingWrites: {
    receiverTypeName: string;
    propertyName: string;
    filePath: string;
    srcId: string;
  }[] = [];
  const globalParentMap = new Map<string, string[]>();
  const globalParentSeen = new Map<string, Set<string>>();
  const logSkipped = isVerboseIngestionEnabled();
  const skippedByLang = logSkipped ? new Map<string, number>() : null;

  interface PreparedFile {
    file: { path: string; content: string };
    language: SupportedLanguages;
    provider: ReturnType<typeof getProvider>;
    tree: unknown;
    matches: ParserQueryMatch[];
    parentMap: ReadonlyMap<string, readonly string[]>;
    typeEnv: ReturnType<typeof buildTypeEnv>;
  }
  const prepared: PreparedFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i % 20 === 0) await yieldToEventLoop();

    const language = getLanguageFromFilename(file.path);
    if (!language) continue;
    if (isRegistryPrimary(language)) continue;
    if (!parserProvider.isLanguageAvailable(language)) {
      if (skippedByLang) {
        skippedByLang.set(language, (skippedByLang.get(language) ?? 0) + 1);
      }
      continue;
    }

    const provider = getProvider(language);
    const queryStr = provider.treeSitterQueries;
    if (!queryStr) continue;

    await parserProvider.loadLanguage(language, file.path);

    let tree: unknown = astCache.get(file.path);
    if (!tree) {
      const parseContent = provider.preprocessSource?.(file.content, file.path) ?? file.content;
      try {
        const result = await parserProvider.parse(parseContent, language, file.path);
        tree = result.internal;
      } catch (parseError) {
        continue;
      }
      astCache.set(file.path, tree as any);
    }

    let matches: ParserQueryMatch[];
    try {
      const query = parserProvider.createQuery(language, queryStr);
      matches = query.matches((tree as any).rootNode);
    } catch (queryError) {
      logger.warn({ queryError }, `Query error for ${file.path}:`);
      continue;
    }

    const fileParentMap = new Map<string, string[]>();
    if (provider.heritageExtractor) {
      for (const match of matches) {
        const captureMap: Record<string, any> = {};
        match.captures.forEach((c) => (captureMap[c.name] = c.node));
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
    for (const [cls, parents] of fileParentMap) {
      let global = globalParentMap.get(cls);
      let seen = globalParentSeen.get(cls);
      if (!global) {
        global = [];
        globalParentMap.set(cls, global);
      }
      if (!seen) {
        seen = new Set();
        globalParentSeen.set(cls, seen);
      }
      for (const p of parents) {
        if (!seen.has(p)) {
          seen.add(p);
          global.push(p);
        }
      }
    }

    const importedBindings = importedBindingsMap?.get(file.path);
    const importedReturnTypes = importedReturnTypesMap?.get(file.path);
    const importedRawReturnTypes = importedRawReturnTypesMap?.get(file.path);
    const typeEnv = buildTypeEnv(tree as unknown as Parameters<typeof buildTypeEnv>[0], language, {
      model: ctx.model,
      parentMap,
      importedBindings,
      importedReturnTypes,
      importedRawReturnTypes,
      enclosingFunctionFinder: provider?.enclosingFunctionFinder,
      extractFunctionName: provider?.methodExtractor?.extractFunctionName,
    });
    if (typeEnv && exportedTypeMap) {
      const fileExports = collectExportedBindings(typeEnv, file.path, ctx.model.symbols, graph);
      if (fileExports) exportedTypeMap.set(file.path, fileExports);
    }
    if (bindingAccumulator) {
      typeEnv.flush(file.path, bindingAccumulator);
    }

    prepared.push({ file, language, provider, tree, matches, parentMap, typeEnv });
  }

  for (let i = 0; i < prepared.length; i++) {
    const { file, language, provider, tree, matches, parentMap, typeEnv } = prepared[i];

    enclosingFnExtractCache.clear();
    onProgress?.(i + 1, files.length);
    if (i % 20 === 0) await yieldToEventLoop();

    const callRouter = provider.callRouter;

    const verifiedReceivers =
      typeEnv.constructorBindings.length > 0
        ? verifyConstructorBindings(
            typeEnv.constructorBindings,
            file.path,
            ctx,
            undefined,
            bindingAccumulator,
          )
        : new Map<string, string>();
    const receiverIndex = buildReceiverTypeIndex(verifiedReceivers);

    ctx.enableCache(file.path);
    const widenCache: WidenCache = new Map();

    matches.forEach((match) => {
      const captureMap: Record<string, any> = {};
      match.captures.forEach((c) => (captureMap[c.name] = c.node));

      if (
        captureMap['assignment'] &&
        captureMap['assignment.receiver'] &&
        captureMap['assignment.property']
      ) {
        const receiverNode = captureMap['assignment.receiver'];
        const propertyName: string = captureMap['assignment.property'].text;
        let receiverTypeName: string | undefined;
        const receiverText = receiverNode.text;
        if (receiverText && typeEnv) {
          receiverTypeName = typeEnv.lookup(receiverText, captureMap['assignment']);
        }
        if (!receiverTypeName && receiverText && receiverIndex.size > 0) {
          const enclosing = findEnclosingFunction(
            captureMap['assignment'],
            file.path,
            ctx,
            provider,
          );
          const funcName = enclosing ? extractFuncNameFromSourceId(enclosing) : '';
          receiverTypeName = lookupReceiverType(receiverIndex, funcName, receiverText);
        }
        if (!receiverTypeName && receiverText) {
          const resolved = ctx.resolve(receiverText, file.path);
          if (resolved?.candidates.some((d) => CLASS_LIKE_TYPES.has(d.type))) {
            receiverTypeName = receiverText;
          }
        }
        if (receiverTypeName) {
          const enclosing = findEnclosingFunction(
            captureMap['assignment'],
            file.path,
            ctx,
            provider,
          );
          const srcId = enclosing || generateId('File', file.path);
          pendingWrites.push({ receiverTypeName, propertyName, filePath: file.path, srcId });
        }
        if (!captureMap['call']) return;
      }

      if (!captureMap['call']) return;

      const callNode = captureMap['call'];
      const callExtractor = provider.callExtractor;

      if (callExtractor) {
        const langCallSite = callExtractor.extract(callNode, undefined);
        if (langCallSite) {
          if (provider.isBuiltInName(langCallSite.calledName)) return;

          const sourceId =
            findEnclosingFunction(callNode, file.path, ctx, provider) ||
            generateId('File', file.path);
          const receiverName =
            langCallSite.callForm === 'member' ? langCallSite.receiverName : undefined;
          let receiverTypeName =
            receiverName && typeEnv ? typeEnv.lookup(receiverName, callNode) : undefined;

          if (
            langCallSite.typeAsReceiverHeuristic &&
            receiverName !== undefined &&
            receiverTypeName === undefined &&
            langCallSite.callForm === 'member'
          ) {
            const c0 = receiverName.charCodeAt(0);
            if (c0 >= 65 && c0 <= 90) receiverTypeName = receiverName;
          }

          const resolved = resolveCallTarget(
            {
              calledName: langCallSite.calledName,
              callForm: langCallSite.callForm,
              ...(receiverTypeName !== undefined ? { receiverTypeName } : {}),
              ...(receiverName !== undefined ? { receiverName } : {}),
            },
            file.path,
            ctx,
            undefined,
            widenCache,
            undefined,
            heritageMap,
          );

          if (!resolved) return;
          graph.addRelationship({
            id: generateId('CALLS', `${sourceId}:${langCallSite.calledName}->${resolved.nodeId}`),
            sourceId,
            targetId: resolved.nodeId,
            type: 'CALLS',
            confidence: resolved.confidence,
            reason: resolved.reason,
          });

          if (heritageMap && langCallSite.callForm === 'member' && receiverTypeName) {
            const implTargets = findInterfaceDispatchTargets(
              langCallSite.calledName,
              receiverTypeName,
              file.path,
              ctx,
              heritageMap,
              resolved.nodeId,
            );
            for (const impl of implTargets) {
              graph.addRelationship({
                id: generateId('CALLS', `${sourceId}:${langCallSite.calledName}->${impl.nodeId}`),
                sourceId,
                targetId: impl.nodeId,
                type: 'CALLS',
                confidence: impl.confidence,
                reason: impl.reason,
              });
            }
          }
          return;
        }
      }

      const nameNode = captureMap['call.name'];
      if (!nameNode) return;

      const calledName = nameNode.text;

      if (provider.heritageExtractor?.extractFromCall) {
        const heritageItems = provider.heritageExtractor.extractFromCall(
          calledName,
          captureMap['call'],
          { filePath: file.path, language },
        );
        if (heritageItems !== null) {
          for (const item of heritageItems) {
            collectedHeritage.push({
              filePath: file.path,
              className: item.className,
              parentName: item.parentName,
              kind: item.kind,
            });
          }
          return;
        }
      }

      const routed = callRouter?.(calledName, captureMap['call']);
      if (routed) {
        switch (routed.kind) {
          case 'skip':
          case 'import':
            return;

          case 'properties': {
            const fileId = generateId('File', file.path);
            const propEnclosingClassId = findEnclosingClassId(captureMap['call'], file.path);
            for (const item of routed.items) {
              const nodeId = generateId('Property', `${file.path}:${item.propName}`);
              graph.addNode({
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
                },
              });
              ctx.model.symbols.add(file.path, item.propName, nodeId, 'Property', {
                ...(propEnclosingClassId ? { ownerId: propEnclosingClassId } : {}),
                ...(item.declaredType ? { declaredType: item.declaredType } : {}),
              });
              const relId = generateId('DEFINES', `${fileId}->${nodeId}`);
              graph.addRelationship({
                id: relId,
                sourceId: fileId,
                targetId: nodeId,
                type: 'DEFINES',
                confidence: 1.0,
                reason: '',
              });
              if (propEnclosingClassId) {
                graph.addRelationship({
                  id: generateId('HAS_PROPERTY', `${propEnclosingClassId}->${nodeId}`),
                  sourceId: propEnclosingClassId,
                  targetId: nodeId,
                  type: 'HAS_PROPERTY',
                  confidence: 1.0,
                  reason: '',
                });
              }
            }
            return;
          }

          case 'call':
            break;
        }
      }

      if (provider.isBuiltInName(calledName)) return;

      let callForm = inferCallForm(callNode, nameNode);
      let receiverName = callForm === 'member' ? extractReceiverName(nameNode) : undefined;
      let receiverTypeName =
        receiverName && typeEnv ? typeEnv.lookup(receiverName, callNode) : undefined;
      let receiverSource: ReceiverSource = receiverTypeName ? 'typed-binding' : 'none';

      if (receiverTypeName && receiverName && typeEnv && typeEnv.constructorTypeMap.size > 0) {
        let scope = '';
        let p = callNode.parent;
        while (p) {
          if (FUNCTION_NODE_TYPES.has(p.type)) {
            const funcName =
              provider.methodExtractor?.extractFunctionName?.(p)?.funcName ?? genericFuncName(p);
            if (funcName) {
              scope = `${funcName}@${p.startIndex}`;
              break;
            }
          }
          p = p.parent;
        }
        const ctorType = typeEnv.constructorTypeMap.get(`${scope}\0${receiverName}`);
        if (ctorType && ctorType !== receiverTypeName) {
          if (
            isSubclassOf(ctorType, receiverTypeName, parentMap) ||
            isSubclassOf(ctorType, receiverTypeName, globalParentMap) ||
            (ctx.model.types.lookupClassByName(ctorType).length > 0 &&
              ctx.model.types.lookupClassByName(receiverTypeName).length > 0)
          ) {
            receiverTypeName = ctorType;
            receiverSource = 'constructor-map';
          }
        }
      }
      if (!receiverTypeName && receiverName && receiverIndex.size > 0) {
        const enclosingFunc = findEnclosingFunction(callNode, file.path, ctx, provider);
        const funcName = enclosingFunc ? extractFuncNameFromSourceId(enclosingFunc) : '';
        receiverTypeName = lookupReceiverType(receiverIndex, funcName, receiverName);
        if (receiverTypeName) receiverSource = 'constructor-map';
      }
      if (!receiverTypeName && receiverName && callForm === 'member') {
        const typeResolved = ctx.resolve(receiverName, file.path);
        if (
          typeResolved &&
          typeResolved.candidates.some(
            (d) =>
              d.type === 'Class' ||
              d.type === 'Interface' ||
              d.type === 'Struct' ||
              d.type === 'Enum' ||
              d.type === 'Trait',
          )
        ) {
          receiverTypeName = receiverName;
          receiverSource = 'class-as-receiver';
        }
      }
      const enclosingFuncId = findEnclosingFunction(callNode, file.path, ctx, provider);
      const sourceId = enclosingFuncId || generateId('File', file.path);

      if (callForm === 'member' && !receiverTypeName && !receiverName) {
        const receiverNode = extractReceiverNode(nameNode);
        if (receiverNode) {
          const extracted = extractMixedChain(receiverNode);
          if (extracted && extracted.chain.length > 0) {
            let currentType =
              extracted.baseReceiverName && typeEnv
                ? typeEnv.lookup(extracted.baseReceiverName, callNode)
                : undefined;
            if (!currentType && extracted.baseReceiverName && receiverIndex.size > 0) {
              const funcName = enclosingFuncId ? extractFuncNameFromSourceId(enclosingFuncId) : '';
              currentType = lookupReceiverType(receiverIndex, funcName, extracted.baseReceiverName);
            }
            if (!currentType && extracted.baseReceiverName) {
              const cr = ctx.resolve(extracted.baseReceiverName, file.path);
              if (
                cr?.candidates.some(
                  (d) =>
                    d.type === 'Class' ||
                    d.type === 'Interface' ||
                    d.type === 'Struct' ||
                    d.type === 'Enum',
                )
              ) {
                currentType = extracted.baseReceiverName;
              }
            }
            if (currentType) {
              receiverTypeName = walkMixedChain(
                extracted.chain,
                currentType,
                file.path,
                ctx,
                makeAccessEmitter(graph, sourceId),
                heritageMap,
              );
              if (receiverTypeName) receiverSource = 'mixed-chain';
            }
          }
        }
      }

      let dispatchHint: string | undefined;
      if (provider.inferImplicitReceiver) {
        const override = provider.inferImplicitReceiver({
          calledName,
          callForm,
          receiverName,
          receiverTypeName,
          callNode,
          filePath: file.path,
        });
        if (override) {
          callForm = override.callForm;
          receiverName = override.receiverName;
          receiverTypeName = override.receiverTypeName;
          receiverSource = override.receiverSource;
          dispatchHint = override.hint;
        }
      }

      const dispatchDecision: DispatchDecision =
        provider.selectDispatch?.({
          calledName,
          callForm,
          receiverName,
          receiverTypeName,
          receiverSource,
          hint: dispatchHint,
        }) ?? defaultDispatchDecision(callForm);

      const resolved = resolveCallTarget(
        {
          calledName,
          argCount: countCallArguments(callNode),
          callForm,
          receiverTypeName,
          receiverName,
        },
        file.path,
        ctx,
        undefined,
        widenCache,
        undefined,
        heritageMap,
        dispatchDecision,
      );

      if (!resolved) return;

      const relId = generateId('CALLS', `${sourceId}:${calledName}->${resolved.nodeId}`);

      graph.addRelationship({
        id: relId,
        sourceId,
        targetId: resolved.nodeId,
        type: 'CALLS',
        confidence: resolved.confidence,
        reason: resolved.reason,
      });

      if (heritageMap && callForm === 'member' && receiverTypeName) {
        const implTargets = findInterfaceDispatchTargets(
          calledName,
          receiverTypeName,
          file.path,
          ctx,
          heritageMap,
          resolved.nodeId,
        );
        for (const impl of implTargets) {
          graph.addRelationship({
            id: generateId('CALLS', `${sourceId}:${calledName}->${impl.nodeId}`),
            sourceId,
            targetId: impl.nodeId,
            type: 'CALLS',
            confidence: impl.confidence,
            reason: impl.reason,
          });
        }
      }
    });

    if (language === SupportedLanguages.Vue) {
      const templateComponents = extractTemplateComponents(file.content);
      if (templateComponents.length > 0) {
        const fileId = generateId('File', file.path);
        const importedFiles = ctx.importMap.get(file.path);
        if (importedFiles) {
          for (const componentName of templateComponents) {
            for (const importedPath of importedFiles) {
              if (!importedPath.endsWith('.vue')) continue;
              const basename = importedPath.slice(
                importedPath.lastIndexOf('/') + 1,
                importedPath.lastIndexOf('.'),
              );
              if (basename !== componentName) continue;
              const targetFileId = generateId('File', importedPath);
              if (graph.getNode(targetFileId)) {
                graph.addRelationship({
                  id: generateId('CALLS', `${fileId}:${componentName}->${targetFileId}`),
                  sourceId: fileId,
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
      }
    }

    ctx.clearCache();
  }

  for (const pw of pendingWrites) {
    const fieldOwner = resolveFieldOwnership(
      pw.receiverTypeName,
      pw.propertyName,
      pw.filePath,
      ctx,
    );
    if (fieldOwner) {
      graph.addRelationship({
        id: generateId('ACCESSES', `${pw.srcId}:${fieldOwner.nodeId}:write`),
        sourceId: pw.srcId,
        targetId: fieldOwner.nodeId,
        type: 'ACCESSES',
        confidence: 1.0,
        reason: 'write',
      });
    }
  }

  if (skippedByLang && skippedByLang.size > 0) {
    for (const [lang, count] of skippedByLang.entries()) {
      logger.warn(
        `[ingestion] Skipped ${count} ${lang} file(s) in call processing — ${lang} parser not available.`,
      );
    }
  }

  return collectedHeritage;
};