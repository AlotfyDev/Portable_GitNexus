import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ExtractedAssignment, FileConstructorBindings } from '../../workers/parse-worker.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { BindingAccumulator } from '../../binding-accumulator.js';
export declare const processAssignmentsFromExtracted: (graph: KnowledgeGraph, assignments: ExtractedAssignment[], ctx: ResolutionContext, constructorBindings?: FileConstructorBindings[], bindingAccumulator?: BindingAccumulator) => void;
