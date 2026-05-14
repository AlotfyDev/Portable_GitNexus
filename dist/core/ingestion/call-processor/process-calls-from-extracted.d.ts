import type { KnowledgeGraph } from '../../graph/types.js';
import type { ExtractedCall, FileConstructorBindings } from '../workers/parse-worker.js';
import type { ResolutionContext } from '../model/resolution-context.js';
import type { HeritageMap } from '../model/index.js';
import type { BindingAccumulator } from '../binding-accumulator.js';
export declare const processCallsFromExtracted: (graph: KnowledgeGraph, extractedCalls: ExtractedCall[], ctx: ResolutionContext, onProgress?: (current: number, total: number) => void, constructorBindings?: FileConstructorBindings[], heritageMap?: HeritageMap, bindingAccumulator?: BindingAccumulator) => Promise<void>;
