import { conn } from './connection.js';
import { getVectorExtensionLoaded, setVectorExtensionLoaded } from './connection.js';
import { extensionManager, type ExtensionEnsureOptions } from '../extension-loader.js';
import { isVectorExtensionSupportedByPlatform } from '../../platform/capabilities.js';
import { logger } from '../../logger.js';

export const loadVectorExtension = async (
  targetConn?: import('@ladybugdb/core').Connection,
  opts: ExtensionEnsureOptions = {},
): Promise<boolean> => {
  const useModuleState = targetConn === undefined;
  if (useModuleState && getVectorExtensionLoaded()) return true;
  if (!isVectorExtensionSupportedByPlatform()) return false;

  const c = targetConn ?? conn;
  if (!c) {
    throw new Error('LadybugDB not initialized. Call initLbug first.');
  }

  try {
    const loaded = await extensionManager.ensure((sql: string) => c.query(sql), 'VECTOR', 'VECTOR', opts);
    if (loaded && useModuleState) setVectorExtensionLoaded(true);
    return loaded;
  } catch {
    logger.warn('VECTOR extension load failed; semantic search will use exact scan fallback.');
    return false;
  }
};
