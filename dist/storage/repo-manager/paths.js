import { realpathSync } from 'fs';
import path from 'path';
import os from 'os';
import { GITNEXUS_DIR } from './constants.js';
export const canonicalizePath = (p) => {
    const resolved = path.resolve(p);
    try {
        return realpathSync.native(resolved);
    }
    catch {
        return resolved;
    }
};
export const getStoragePath = (repoPath) => {
    return path.join(path.resolve(repoPath), GITNEXUS_DIR);
};
export const getStoragePaths = (repoPath) => {
    const storagePath = getStoragePath(repoPath);
    return {
        storagePath,
        lbugPath: path.join(storagePath, 'lbug'),
        metaPath: path.join(storagePath, 'meta.json'),
    };
};
export const getGlobalDir = () => {
    return process.env.GITNEXUS_HOME || path.join(os.homedir(), '.gitnexus');
};
export const getGlobalRegistryPath = () => {
    return path.join(getGlobalDir(), 'registry.json');
};
export const getGlobalConfigPath = () => {
    return path.join(getGlobalDir(), 'config.json');
};
