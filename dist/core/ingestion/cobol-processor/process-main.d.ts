import type { KnowledgeGraph } from '../../graph/types.js';
import { CobolFile, CobolProcessResult } from './types.js';
/**
 * Process COBOL and JCL files into the knowledge graph.
 *
 * @param graph    - The in-memory knowledge graph
 * @param files    - Array of { path, content } for COBOL/JCL files
 * @param allPathSet - Set of all file paths in the repository
 * @returns Summary of what was extracted
 */
declare const processCobol: (graph: KnowledgeGraph, files: CobolFile[], allPathSet: ReadonlySet<string>) => CobolProcessResult;
export { processCobol };
