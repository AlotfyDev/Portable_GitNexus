import { IVecDBProvider } from './provider.js';
import type { VectorStoreCapabilities, VectorRecord, SearchResult, SearchOptions } from './types.js';
export declare class LadybugVectorProvider implements IVecDBProvider {
    private readonly executeQuery;
    private readonly executeBatch;
    private readonly tableName;
    private readonly indexName;
    readonly name = "ladybug-vector";
    readonly capabilities: VectorStoreCapabilities;
    constructor(executeQuery: (cypher: string) => Promise<any[]>, executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>, tableName?: string, indexName?: string);
    init(): Promise<void>;
    store(records: VectorRecord[]): Promise<void>;
    search(vector: number[], options: SearchOptions): Promise<SearchResult[]>;
    delete(ids: string[]): Promise<void>;
    count(): Promise<number>;
    clear(): Promise<void>;
    health(): Promise<boolean>;
    dispose(): Promise<void>;
    private ensureVectorIndex;
}
