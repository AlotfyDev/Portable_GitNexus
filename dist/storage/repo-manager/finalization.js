import fs from 'fs/promises';
import path from 'path';
import { getStoragePaths, canonicalizePath, getGlobalRegistryPath } from './paths.js';
import { AnalysisNotFinalizedError } from './errors.js';
import { readRegistry } from './registry/index.js';
export const assertAnalysisFinalized = async (repoPath) => {
    const resolved = path.resolve(repoPath);
    const { storagePath, metaPath } = getStoragePaths(resolved);
    try {
        await fs.access(metaPath);
    }
    catch {
        throw new AnalysisNotFinalizedError(resolved, storagePath, 'meta', getGlobalRegistryPath());
    }
    const entries = await readRegistry();
    const canonicalInput = canonicalizePath(resolved);
    const isWin = process.platform === 'win32';
    const found = entries.some((e) => {
        const a = canonicalizePath(e.path);
        return isWin ? a.toLowerCase() === canonicalInput.toLowerCase() : a === canonicalInput;
    });
    if (!found) {
        throw new AnalysisNotFinalizedError(resolved, storagePath, 'registry-entry', getGlobalRegistryPath());
    }
};
