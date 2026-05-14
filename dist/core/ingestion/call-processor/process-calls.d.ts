import { KnowledgeGraph } from '../../graph/types.js';
import { ASTCache } from '../ast-cache.js';
import type { ExtractedHeritage } from '../model/index.js';
import type { ExportedTypeMap } from './types.js';
import type { ResolutionContext } from '../model/resolution-context.js';
import type { BindingAccumulator } from '../binding-accumulator.js';
export declare const processCalls: (graph: KnowledgeGraph, files: {
    path: string;
    content: string;
}[], astCache: ASTCache, ctx: ResolutionContext, onProgress?: (current: number, total: number) => void, exportedTypeMap?: ExportedTypeMap, importedBindingsMap?: ReadonlyMap<string, ReadonlyMap<string, string>>, importedReturnTypesMap?: ReadonlyMap<string, ReadonlyMap<string, string>>, importedRawReturnTypesMap?: ReadonlyMap<string, ReadonlyMap<string, string>>, heritageMap?: import("../model/index.js").HeritageMap, bindingAccumulator?: BindingAccumulator) => Promise<ExtractedHeritage[]>;
