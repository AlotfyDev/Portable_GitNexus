import { KnowledgeGraph } from '../../graph/types.js';
import type { LbugProgressCallback } from './types.js';
export declare const escapeTableName: (table: string) => string;
export declare const TABLES_WITH_EXPORTED: Set<string>;
export declare const loadGraphToLbug: (graph: KnowledgeGraph, repoPath: string, storagePath: string, onProgress?: LbugProgressCallback) => Promise<{
    success: boolean;
    insertedRels: number;
    skippedRels: number;
    warnings: string[];
}>;
