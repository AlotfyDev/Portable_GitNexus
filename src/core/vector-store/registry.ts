import { IcmVectorProvider } from './icm-provider.js';
import { LadybugVectorProvider } from './ladybug-provider.js';
import type { IVecDBProvider } from './provider.js';
import { LadybugEmbeddingRepository } from '../lbug/repository/embedding-repository.js';
import type { EmbeddingRepository } from '../lbug/repository/embedding-repository.js';
import { ConfigProviderRegistry } from '../config/registry.js';

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
    case 'icm': {
      const config = ConfigProviderRegistry.get().getConfig();
      const icmPath = config.vector_store?.icm?.binary_path ?? './third-party/icm/icm.exe';
      return new IcmVectorProvider(icmPath);
    }
    default:
      return undefined;
  }
}

export function createEmbeddingRepository(
  executeQuery: (cypher: string) => Promise<any[]>,
  executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>,
): EmbeddingRepository {
  const config = ConfigProviderRegistry.get().getConfig();
  const backend = config.vector_store?.backend ?? 'ladybug';
  const enabled = config.vector_store?.enabled;

  if (enabled === false) {
    return new LadybugEmbeddingRepository(executeQuery, executeBatch);
  }

  const provider = createVectorProviderForBackend(backend, executeQuery, executeBatch);
  return new LadybugEmbeddingRepository(executeQuery, executeBatch, undefined, undefined, provider);
}
