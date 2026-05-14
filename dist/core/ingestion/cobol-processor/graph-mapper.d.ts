import type { KnowledgeGraph } from '../../graph/types.js';
import type { CobolRegexResults } from '../cobol/cobol-preprocessor.js';
import { CobolFile } from './types.js';
declare function mapToGraph(graph: KnowledgeGraph, extracted: CobolRegexResults, file: CobolFile, copyResolutions: Array<{
    copyTarget: string;
    resolvedPath: string | null;
    line: number;
}>, moduleNodeIds: Map<string, string>): void;
export { mapToGraph };
