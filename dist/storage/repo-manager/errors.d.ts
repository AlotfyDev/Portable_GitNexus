import type { RegistryEntry } from './types.js';
export declare class RegistryNameCollisionError extends Error {
    readonly registryName: string;
    readonly existingPath: string;
    readonly requestedPath: string;
    readonly kind: "RegistryNameCollisionError";
    constructor(registryName: string, existingPath: string, requestedPath: string);
}
export declare class RegistryNotFoundError extends Error {
    readonly target: string;
    readonly availableNames: string[];
    readonly kind: "RegistryNotFoundError";
    constructor(target: string, availableNames: string[]);
}
export declare class RegistryAmbiguousTargetError extends Error {
    readonly target: string;
    readonly matches: RegistryEntry[];
    readonly kind: "RegistryAmbiguousTargetError";
    constructor(target: string, matches: RegistryEntry[]);
}
export declare class AnalysisNotFinalizedError extends Error {
    readonly repoPath: string;
    readonly storagePath: string;
    readonly missing: 'meta' | 'registry-entry';
    readonly registryPath: string;
    readonly kind: "AnalysisNotFinalizedError";
    constructor(repoPath: string, storagePath: string, missing: 'meta' | 'registry-entry', registryPath: string);
}
export declare class UnsafeStoragePathError extends Error {
    readonly entry: RegistryEntry;
    readonly expectedStoragePath: string;
    readonly actualStoragePath: string;
    readonly kind: "UnsafeStoragePathError";
    constructor(entry: RegistryEntry, expectedStoragePath: string, actualStoragePath: string);
}
