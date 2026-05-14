import { KnowledgeGraph } from '../../../graph/types.js';
import { ASTCache } from '../../ast-cache.js';
import type { SymbolTableWriter } from '../../model/index.js';
import { WorkerPool } from '../../workers/worker-pool.js';
import type { FileProgressCallback, WorkerExtractedData } from '../types.js';
declare const processParsingWithWorkers: (graph: KnowledgeGraph, files: {
    path: string;
    content: string;
}[], symbolTable: SymbolTableWriter, astCache: ASTCache, workerPool: WorkerPool, onFileProgress?: FileProgressCallback) => Promise<WorkerExtractedData>;
export { processParsingWithWorkers };
