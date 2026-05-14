import { IVecDBProvider } from './provider.js';
import type { VectorStoreCapabilities, VectorRecord, SearchResult, SearchOptions } from './types.js';
/**
 * ICM Vector Store Provider
 *
 * Integrates with Portable_ICM (Infinite Context Memory) via its MCP stdio interface.
 * ICM handles embedding storage + vector search internally using SQLite + fastembed.
 *
 * Communication: spawn icm.exe as subprocess, send JSON-RPC via stdin/stdout.
 *
 * MCP tools used:
 *   icm_memory_store   — store a memory (auto-dedup >85%)
 *   icm_memory_recall  — hybrid search (BM25 30% + cosine 70%)
 *   icm_memory_forget  — delete a memory by ID
 *   icm_memory_stats   — global statistics
 *   icm_memory_embed_all — generate all embeddings (batch)
 *
 * Default model: intfloat/multilingual-e5-base (768d)
 * Fallback model: intfloat/multilingual-e5-small (384d)
 */
export declare class IcmVectorProvider implements IVecDBProvider {
    private readonly icmPath;
    readonly name = "icm";
    readonly capabilities: VectorStoreCapabilities;
    constructor(icmPath: string);
    init(): Promise<void>;
    store(records: VectorRecord[]): Promise<void>;
    search(vector: number[], options: SearchOptions): Promise<SearchResult[]>;
    delete(ids: string[]): Promise<void>;
    count(): Promise<number>;
    clear(): Promise<void>;
    health(): Promise<boolean>;
    dispose(): Promise<void>;
}
