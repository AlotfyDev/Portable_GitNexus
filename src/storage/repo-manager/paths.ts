import { realpathSync } from 'fs';
import path from 'path';
import os from 'os';
import { GITNEXUS_DIR } from './constants.js';

export const canonicalizePath = (p: string): string => {
  const resolved = path.resolve(p);
  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
};

export const getStoragePath = (repoPath: string): string => {
  return path.join(path.resolve(repoPath), GITNEXUS_DIR);
};

export const getStoragePaths = (repoPath: string) => {
  const storagePath = getStoragePath(repoPath);
  return {
    storagePath,
    lbugPath: path.join(storagePath, 'lbug'),
    metaPath: path.join(storagePath, 'meta.json'),
  };
};

export const getGlobalDir = (): string => {
  return process.env.GITNEXUS_HOME || path.join(os.homedir(), '.gitnexus');
};

export const getGlobalRegistryPath = (): string => {
  return path.join(getGlobalDir(), 'registry.json');
};

export const getGlobalConfigPath = (): string => {
  return path.join(getGlobalDir(), 'config.json');
};
