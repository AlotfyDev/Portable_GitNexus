import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ExtractedRoute, ExtractedFetchCall } from '../../workers/parse-worker.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import { TIER_CONFIDENCE } from '../../model/resolution-context.js';
import { generateId } from '../../../../lib/utils.js';
import { normalizeFetchURL, routeMatches } from '../../route-extractors/nextjs.js';
import { RESPONSE_ACCESS_BLOCKLIST } from '../constants.js';
import { yieldToEventLoop } from '../../utils/event-loop.js';

export const processRoutesFromExtracted = async (
  graph: KnowledgeGraph,
  extractedRoutes: ExtractedRoute[],
  ctx: ResolutionContext,
  onProgress?: (current: number, total: number) => void,
) => {
  for (let i = 0; i < extractedRoutes.length; i++) {
    const route = extractedRoutes[i];
    if (i % 50 === 0) {
      onProgress?.(i, extractedRoutes.length);
      await yieldToEventLoop();
    }

    if (!route.controllerName || !route.methodName) continue;

    const controllerResolved = ctx.resolve(route.controllerName, route.filePath);
    if (!controllerResolved || controllerResolved.candidates.length === 0) continue;
    if (controllerResolved.tier === 'global' && controllerResolved.candidates.length > 1) continue;

    const controllerDef = controllerResolved.candidates[0];
    const confidence = TIER_CONFIDENCE[controllerResolved.tier];

    const methodResolved = ctx.resolve(route.methodName, controllerDef.filePath);
    const methodId =
      methodResolved?.tier === 'same-file' ? methodResolved.candidates[0]?.nodeId : undefined;
    const sourceId = generateId('File', route.filePath);

    if (!methodId) {
      const guessedId = generateId('Method', `${controllerDef.filePath}:${route.methodName}`);
      const relId = generateId('CALLS', `${sourceId}:route->${guessedId}`);
      graph.addRelationship({
        id: relId,
        sourceId,
        targetId: guessedId,
        type: 'CALLS',
        confidence: confidence * 0.8,
        reason: 'laravel-route',
      });
      continue;
    }

    const relId = generateId('CALLS', `${sourceId}:route->${methodId}`);
    graph.addRelationship({
      id: relId,
      sourceId,
      targetId: methodId,
      type: 'CALLS',
      confidence,
      reason: 'laravel-route',
    });
  }

  onProgress?.(extractedRoutes.length, extractedRoutes.length);
};

export const extractConsumerAccessedKeys = (content: string): string[] => {
  const keys = new Set<string>();

  const destructurePattern =
    /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*(?:await\s+)?(?:\w+\.json\s*\(\)|(?:await\s+)?(?:fetch|axios|got)\s*\([^)]*\)(?:\.then\s*\([^)]*\))?(?:\.json\s*\(\))?)/g;
  let match;
  while ((match = destructurePattern.exec(content)) !== null) {
    const destructuredBody = match[1];
    const keyPattern = /(\w+)\s*(?::\s*\w+)?/g;
    let keyMatch;
    while ((keyMatch = keyPattern.exec(destructuredBody)) !== null) {
      keys.add(keyMatch[1]);
    }
  }

  const dataVarDestructure =
    /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*(?:data|result|response|json|body|res)\b/g;
  while ((match = dataVarDestructure.exec(content)) !== null) {
    const destructuredBody = match[1];
    const keyPattern = /(\w+)\s*(?::\s*\w+)?/g;
    let keyMatch;
    while ((keyMatch = keyPattern.exec(destructuredBody)) !== null) {
      keys.add(keyMatch[1]);
    }
  }

  const propAccessPattern = /\b(?:data|response|result|json|body|res)\s*(?:\?\.|\.)(\w+)/g;
  while ((match = propAccessPattern.exec(content)) !== null) {
    const key = match[1];
    if (!RESPONSE_ACCESS_BLOCKLIST.has(key)) {
      keys.add(key);
    }
  }

  return [...keys];
};

export const processNextjsFetchRoutes = (
  graph: KnowledgeGraph,
  fetchCalls: ExtractedFetchCall[],
  routeRegistry: Map<string, string>,
  consumerContents?: Map<string, string>,
) => {
  const routeCountByFile = new Map<string, number>();
  for (const call of fetchCalls) {
    const normalized = normalizeFetchURL(call.fetchURL);
    if (!normalized) continue;
    for (const [routeURL] of routeRegistry) {
      if (routeMatches(normalized, routeURL)) {
        routeCountByFile.set(call.filePath, (routeCountByFile.get(call.filePath) ?? 0) + 1);
        break;
      }
    }
  }

  for (const call of fetchCalls) {
    const normalized = normalizeFetchURL(call.fetchURL);
    if (!normalized) continue;

    for (const [routeURL] of routeRegistry) {
      if (routeMatches(normalized, routeURL)) {
        const sourceId = generateId('File', call.filePath);
        const routeNodeId = generateId('Route', routeURL);

        let reason = 'fetch-url-match';
        if (consumerContents) {
          const content = consumerContents.get(call.filePath);
          if (content) {
            const accessedKeys = extractConsumerAccessedKeys(content);
            if (accessedKeys.length > 0) {
              reason = `fetch-url-match|keys:${accessedKeys.join(',')}`;
            }
          }
        }

        const fetchCount = routeCountByFile.get(call.filePath) ?? 1;
        if (fetchCount > 1) {
          reason = `${reason}|fetches:${fetchCount}`;
        }

        graph.addRelationship({
          id: generateId('FETCHES', `${sourceId}->${routeNodeId}`),
          sourceId,
          targetId: routeNodeId,
          type: 'FETCHES',
          confidence: 0.9,
          reason,
        });
        break;
      }
    }
  }
};
