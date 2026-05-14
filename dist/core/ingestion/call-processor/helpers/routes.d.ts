import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ExtractedRoute, ExtractedFetchCall } from '../../workers/parse-worker.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
export declare const processRoutesFromExtracted: (graph: KnowledgeGraph, extractedRoutes: ExtractedRoute[], ctx: ResolutionContext, onProgress?: (current: number, total: number) => void) => Promise<void>;
export declare const extractConsumerAccessedKeys: (content: string) => string[];
export declare const processNextjsFetchRoutes: (graph: KnowledgeGraph, fetchCalls: ExtractedFetchCall[], routeRegistry: Map<string, string>, consumerContents?: Map<string, string>) => void;
