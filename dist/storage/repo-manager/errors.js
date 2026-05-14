import path from 'path';
export class RegistryNameCollisionError extends Error {
    registryName;
    existingPath;
    requestedPath;
    kind = 'RegistryNameCollisionError';
    constructor(registryName, existingPath, requestedPath) {
        super(`Registry name "${registryName}" is already used by "${existingPath}".\n` +
            `Pass --name <alias> to register "${requestedPath}" under a different name, ` +
            `or --allow-duplicate-name to allow both paths under the same name (leaves -r <name> ambiguous for these two).`);
        this.registryName = registryName;
        this.existingPath = existingPath;
        this.requestedPath = requestedPath;
        this.name = 'RegistryNameCollisionError';
    }
}
export class RegistryNotFoundError extends Error {
    target;
    availableNames;
    kind = 'RegistryNotFoundError';
    constructor(target, availableNames) {
        const hint = availableNames.length > 0
            ? ` Available: ${availableNames.join(', ')}.`
            : ' No repositories are currently registered.';
        super(`No registered repo matches "${target}".${hint}`);
        this.target = target;
        this.availableNames = availableNames;
        this.name = 'RegistryNotFoundError';
    }
}
export class RegistryAmbiguousTargetError extends Error {
    target;
    matches;
    kind = 'RegistryAmbiguousTargetError';
    constructor(target, matches) {
        const listing = matches.map((m) => `  - ${m.name}  (${m.path})`).join('\n');
        super(`Multiple registered repos match "${target}":\n${listing}\n` +
            `Pass the absolute path instead to disambiguate.`);
        this.target = target;
        this.matches = matches;
        this.name = 'RegistryAmbiguousTargetError';
    }
}
export class AnalysisNotFinalizedError extends Error {
    repoPath;
    storagePath;
    missing;
    registryPath;
    kind = 'AnalysisNotFinalizedError';
    constructor(repoPath, storagePath, missing, registryPath) {
        const detail = missing === 'meta'
            ? `meta.json was not written to ${path.join(storagePath, 'meta.json')}`
            : `registry entry for ${repoPath} was not added to ${registryPath}`;
        super(`Analysis did not finalize for ${repoPath}: ${detail}. ` +
            `The on-disk index is incomplete and was not registered. ` +
            `Re-run "gitnexus analyze" — if the problem persists, inspect ` +
            `${storagePath} for a stale lbug.wal that signals an aborted write.`);
        this.repoPath = repoPath;
        this.storagePath = storagePath;
        this.missing = missing;
        this.registryPath = registryPath;
        this.name = 'AnalysisNotFinalizedError';
    }
}
export class UnsafeStoragePathError extends Error {
    entry;
    expectedStoragePath;
    actualStoragePath;
    kind = 'UnsafeStoragePathError';
    constructor(entry, expectedStoragePath, actualStoragePath) {
        super(`Refusing to remove storage path for safety: expected ` +
            `"${expectedStoragePath}" under the repo's .gitnexus subfolder, ` +
            `but the registry entry has "${actualStoragePath}". ` +
            `This usually means the registry entry is corrupted or was ` +
            `hand-edited. Delete the entry manually from ~/.gitnexus/registry.json ` +
            `and re-run analyze.`);
        this.entry = entry;
        this.expectedStoragePath = expectedStoragePath;
        this.actualStoragePath = actualStoragePath;
        this.name = 'UnsafeStoragePathError';
    }
}
