import os from 'os';
import { createRequire } from 'module';
import { DEV_APP_ROOT_URL } from '../../generated/constants.js';
import { getPortability } from '../portability/index.js';
import { getVersion } from '../environment.js';
import { loadPortableConfig } from '../../config/portable-config.js';
let _require = null;
function getRequire() {
    if (getPortability().isPortable) {
        throw new Error('Native require not available in portable mode');
    }
    if (!_require) {
        _require = createRequire(DEV_APP_ROOT_URL);
    }
    return _require;
}
const packageVersion = (name) => {
    if (getPortability().isPortable)
        return undefined;
    try {
        const req = getRequire();
        return req(`${name}/package.json`).version;
    }
    catch {
        return undefined;
    }
};
const gitnexusVersion = () => {
    return getVersion();
};
const parsePositiveInt = (value, fallback) => {
    if (value === undefined)
        return fallback;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
export const DEFAULT_EXACT_SCAN_LIMIT = 10_000;
export const getExactScanLimit = () => parsePositiveInt(process.env.GITNEXUS_SEMANTIC_EXACT_SCAN_LIMIT, DEFAULT_EXACT_SCAN_LIMIT);
export const getRuntimeFingerprint = () => ({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    gitnexus: gitnexusVersion(),
    ladybugdb: packageVersion('@ladybugdb/core'),
    onnxruntime: packageVersion('onnxruntime-node'),
});
export const isVectorExtensionSupportedByPlatform = (platform = process.platform) => {
    const config = loadPortableConfig();
    const setting = config.vector_store?.enabled ?? 'auto';
    if (setting === false)
        return false;
    if (setting === true)
        return true;
    return true;
};
export const getRuntimeCapabilities = () => {
    const vector = isVectorExtensionSupportedByPlatform() ? 'available' : 'unavailable';
    const exactScanLimit = getExactScanLimit();
    return {
        graph: 'available',
        fts: 'available',
        vector,
        semanticMode: vector === 'available' ? 'vector-index' : 'exact-scan',
        exactScanLimit,
        reason: vector === 'unavailable'
            ? 'LadybugDB VECTOR is disabled by config or unavailable; semantic search uses exact scan when embeddings exist.'
            : undefined,
    };
};
export const defaultEmbeddingThreads = () => {
    const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
    return Math.max(1, Math.min(4, Math.floor(available / 2) || 1));
};
