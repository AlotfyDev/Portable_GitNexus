import { KnowledgeGraph } from '../../../graph/types.js';
import type { SymbolTableWriter } from '../../model/index.js';
import { ASTCache } from '../../ast-cache.js';
import type { FileProgressCallback } from '../types.js';
declare const processParsingSequential: (graph: KnowledgeGraph, files: {
    path: string;
    content: string;
}[], symbolTable: SymbolTableWriter, astCache: ASTCache, scopeTreeCache: ASTCache | undefined, onFileProgress?: FileProgressCallback) => Promise<void>;
export { processParsingSequential };
