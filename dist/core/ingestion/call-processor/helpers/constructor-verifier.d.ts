import type { ResolutionContext } from '../../model/resolution-context.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { BindingAccumulator } from '../../binding-accumulator.js';
import type { ConstructorBinding } from '../../type-env.js';
/**
 * Verify constructor bindings against SymbolTable and infer receiver types.
 * Shared between sequential (processCalls) and worker (processCallsFromExtracted) paths.
 */
export declare const verifyConstructorBindings: (bindings: readonly ConstructorBinding[], filePath: string, ctx: ResolutionContext, graph?: KnowledgeGraph, bindingAccumulator?: BindingAccumulator) => Map<string, string>;
