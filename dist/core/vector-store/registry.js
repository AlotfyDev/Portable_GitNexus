import { IcmVectorProvider } from './icm-provider.js';
import { LadybugVectorProvider } from './ladybug-provider.js';
import { LadybugEmbeddingRepository } from '../lbug/repository/embedding-repository.js';
import { loadPortableConfig } from '../../config/portable-config.js';
export function createVectorProvider(config) {
    switch (config.backend) {
        case 'icm':
            return new IcmVectorProvider(config.icm.binaryPath);
        case 'ladybug':
            throw new Error('Ladybug VECTOR not available on Windows — coming soon');
        default:
            throw new Error(`Vector store backend '${config.backend}' not yet implemented`);
    }
}
export function createVectorProviderForBackend(backend, executeQuery, executeBatch) {
    switch (backend) {
        case 'ladybug':
            return new LadybugVectorProvider(executeQuery, executeBatch);
        case 'icm':
            return undefined;
        default:
            return undefined;
    }
}
export function createEmbeddingRepository(executeQuery, executeBatch) {
    const config = loadPortableConfig();
    const backend = config.vector_store?.backend ?? 'ladybug';
    const enabled = config.vector_store?.enabled;
    if (enabled === false) {
        return new LadybugEmbeddingRepository(executeQuery, executeBatch);
    }
    const provider = createVectorProviderForBackend(backend, executeQuery, executeBatch);
    return new LadybugEmbeddingRepository(executeQuery, executeBatch, undefined, undefined, provider);
}
