import { GITNEXUS_VERSION, DEV_APP_ROOT_URL } from '../generated/constants.js';
import { getPortability } from './portability/index.js';

export function getVersion(): string {
  return GITNEXUS_VERSION;
}

export function isPortable(): boolean {
  return getPortability().isPortable;
}

export function isEmbeddingsEnabled(): boolean {
  return true;
}

export function getAppRoot(): URL | null {
  if (DEV_APP_ROOT_URL) {
    return new URL(DEV_APP_ROOT_URL);
  }
  return null;
}

export function resolveAppPath(...segments: string[]): URL | null {
  const root = getAppRoot();
  if (!root) return null;
  return new URL(segments.join('/'), root);
}
