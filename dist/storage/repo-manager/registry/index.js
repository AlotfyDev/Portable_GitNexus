import fs from 'fs/promises';
import path from 'path';
import { getGlobalDir, getGlobalRegistryPath, canonicalizePath } from '../paths.js';
import { UnsafeStoragePathError, RegistryNotFoundError, RegistryAmbiguousTargetError } from '../errors.js';
export const readRegistry = async () => {
    try {
        const raw = await fs.readFile(getGlobalRegistryPath(), 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
};
export const writeRegistry = async (entries) => {
    const dir = getGlobalDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(getGlobalRegistryPath(), JSON.stringify(entries, null, 2), 'utf-8');
};
export const unregisterRepo = async (repoPath) => {
    const resolved = canonicalizePath(repoPath);
    const entries = await readRegistry();
    const matches = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
    const filtered = entries.filter((e) => !matches(canonicalizePath(e.path), resolved));
    await writeRegistry(filtered);
};
export const assertSafeStoragePath = (entry) => {
    const expected = path.join(path.resolve(entry.path), '.gitnexus');
    const actual = path.resolve(entry.storagePath);
    const matches = process.platform === 'win32'
        ? expected.toLowerCase() === actual.toLowerCase()
        : expected === actual;
    if (!matches) {
        throw new UnsafeStoragePathError(entry, expected, actual);
    }
};
export const resolveRegistryEntry = (entries, target) => {
    const canonicalTarget = canonicalizePath(target);
    const pathMatch = entries.find((e) => {
        const a = canonicalizePath(e.path);
        const b = canonicalTarget;
        return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
    });
    if (pathMatch)
        return pathMatch;
    const targetLower = target.toLowerCase();
    const nameMatches = entries.filter((e) => e.name.toLowerCase() === targetLower);
    if (nameMatches.length === 1)
        return nameMatches[0];
    if (nameMatches.length > 1) {
        throw new RegistryAmbiguousTargetError(target, nameMatches);
    }
    const nameCounts = new Map();
    for (const e of entries) {
        const key = e.name.toLowerCase();
        nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    const availableNames = entries.map((e) => (nameCounts.get(e.name.toLowerCase()) ?? 0) > 1 ? `${e.name} (${e.path})` : e.name);
    throw new RegistryNotFoundError(target, availableNames);
};
export const listRegisteredRepos = async (opts) => {
    const entries = await readRegistry();
    if (!opts?.validate)
        return entries;
    const valid = [];
    for (const entry of entries) {
        try {
            await fs.access(path.join(entry.storagePath, 'meta.json'));
            valid.push(entry);
        }
        catch {
            // skip
        }
    }
    if (valid.length !== entries.length) {
        await writeRegistry(valid);
    }
    return valid;
};
export const findSiblingClones = async (remoteUrl, selfPath) => {
    if (!remoteUrl)
        return [];
    const entries = await readRegistry();
    const isWin = process.platform === 'win32';
    const norm = (p) => (isWin ? path.resolve(p).toLowerCase() : path.resolve(p));
    const self = norm(selfPath);
    return entries.filter((e) => e.remoteUrl === remoteUrl && norm(e.path) !== self);
};
