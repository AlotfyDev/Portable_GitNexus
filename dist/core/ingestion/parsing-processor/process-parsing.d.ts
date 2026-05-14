import { KnowledgeGraph } from '../../graph/types.js';
import type { SymbolTableWriter } from '../model/index.js';
import { ASTCache } from '../ast-cache.js';
import type { FileProgressCallback, WorkerExtractedData } from './types.js';
import type { WorkerPool } from '../workers/worker-pool.js';
export declare const processParsing: (graph: KnowledgeGraph, files: {
    path: string;
    content: string;
}[], symbolTable: SymbolTableWriter, astCache: ASTCache, scopeTreeCache: ASTCache | undefined, onFileProgress?: FileProgressCallback, workerPool?: WorkerPool) => Promise<WorkerExtractedData | null>;
