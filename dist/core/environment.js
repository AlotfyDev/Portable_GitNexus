import { GITNEXUS_VERSION, DEV_APP_ROOT_URL } from '../generated/constants.js';
import { getPortability } from './portability/index.js';
export function getVersion() {
    return GITNEXUS_VERSION;
}
export function isPortable() {
    return getPortability().isPortable;
}
export function isEmbeddingsEnabled() {
    return true;
}
export function getAppRoot() {
    if (DEV_APP_ROOT_URL) {
        return new URL(DEV_APP_ROOT_URL);
    }
    return null;
}
export function resolveAppPath(...segments) {
    const root = getAppRoot();
    if (!root)
        return null;
    return new URL(segments.join('/'), root);
}
