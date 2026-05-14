import type { IVecDBProvider } from './provider.js';
import type { EmbeddingRepository } from '../lbug/repository/embedding-repository.js';
export type VectorDBBackend = 'icm' | 'ladybug' | 'postgres-pgvector' | 'chromadb' | 'lancedb' | 'faiss';
export interface VectorStoreConfig {
    backend: VectorDBBackend;
    icm?: {
        binaryPath: string;
    };
}
export declare function createVectorProvider(config: VectorStoreConfig): IVecDBProvider;
export declare function createVectorProviderForBackend(backend: string, executeQuery: (cypher: string) => Promise<any[]>, executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>): IVecDBProvider | undefined;
export declare function createEmbeddingRepository(executeQuery: (cypher: string) => Promise<any[]>, executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>): EmbeddingRepository;
