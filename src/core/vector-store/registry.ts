import { IcmVectorProvider } from './icm-provider.js';
import { LadybugVectorProvider } from './ladybug-provider.js';
import type { IVecDBProvider } from './provider.js';
import { LadybugEmbeddingRepository } from '../lbug/repository/embedding-repository.js';
import type { EmbeddingRepository } from '../lbug/repository/embedding-repository.js';
import { loadPortableConfig } from '../../config/portable-config.js';

export type VectorDBBackend = 'icm' | 'ladybug' | 'postgres-pgvector' | 'chromadb' | 'lancedb' | 'faiss';

export interface VectorStoreConfig {
  backend: VectorDBBackend;
  icm?: { binaryPath: string };
}

export function createVectorProvider(config: VectorStoreConfig): IVecDBProvider {
  switch (config.backend) {
    case 'icm':
      return new IcmVectorProvider(config.icm!.binaryPath);
    case 'ladybug':
      throw new Error('Ladybug VECTOR not available on Windows — coming soon');
    default:
      throw new Error(`Vector store backend '${config.backend}' not yet implemented`);
  }
}

export function createVectorProviderForBackend(
  backend: string,
  executeQuery: (cypher: string) => Promise<any[]>,
  executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>,
): IVecDBProvider | undefined {
  switch (backend) {
    case 'ladybug':
      return new LadybugVectorProvider(executeQuery, executeBatch);
    case 'icm':
      return undefined;
    default:
      return undefined;
  }
}

export function createEmbeddingRepository(
  executeQuery: (cypher: string) => Promise<any[]>,
  executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>,
): EmbeddingRepository {
  const config = loadPortableConfig();
  const backend = config.vector_store?.backend ?? 'ladybug';
  const enabled = config.vector_store?.enabled;

  if (enabled === false) {
    return new LadybugEmbeddingRepository(executeQuery, executeBatch);
  }

  const provider = createVectorProviderForBackend(backend, executeQuery, executeBatch);
  return new LadybugEmbeddingRepository(executeQuery, executeBatch, undefined, undefined, provider);
}
