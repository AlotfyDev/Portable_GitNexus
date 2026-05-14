import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ExportedTypeMap } from '../types.js';
import type { SymbolTableReader } from '../../model/index.js';
export declare function buildImportedReturnTypes(filePath: string, namedImportMap: ReadonlyMap<string, ReadonlyMap<string, {
    sourcePath: string;
    exportedName: string;
}>>, symbolTable: {
    lookupExactFull(filePath: string, name: string): {
        returnType?: string;
    } | undefined;
}): ReadonlyMap<string, string>;
export declare function buildImportedRawReturnTypes(filePath: string, namedImportMap: ReadonlyMap<string, ReadonlyMap<string, {
    sourcePath: string;
    exportedName: string;
}>>, symbolTable: {
    lookupExactFull(filePath: string, name: string): {
        returnType?: string;
    } | undefined;
}): ReadonlyMap<string, string>;
export declare function collectExportedBindings(typeEnv: {
    fileScope(): ReadonlyMap<string, string>;
}, filePath: string, symbolTable: {
    lookupExact(filePath: string, name: string): string | undefined;
}, graph: {
    getNode(id: string): {
        properties?: {
            isExported?: boolean;
        };
    } | undefined;
}): Map<string, string> | null;
export declare function buildExportedTypeMapFromGraph(graph: KnowledgeGraph, symbolTable: SymbolTableReader): ExportedTypeMap;
