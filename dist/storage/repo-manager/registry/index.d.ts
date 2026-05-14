import type { RegistryEntry } from '../types.js';
export declare const readRegistry: () => Promise<RegistryEntry[]>;
export declare const writeRegistry: (entries: RegistryEntry[]) => Promise<void>;
export declare const unregisterRepo: (repoPath: string) => Promise<void>;
export declare const assertSafeStoragePath: (entry: RegistryEntry) => void;
export declare const resolveRegistryEntry: (entries: RegistryEntry[], target: string) => RegistryEntry;
export declare const listRegisteredRepos: (opts?: {
    validate?: boolean;
}) => Promise<RegistryEntry[]>;
export declare const findSiblingClones: (remoteUrl: string | undefined, selfPath: string) => Promise<RegistryEntry[]>;
