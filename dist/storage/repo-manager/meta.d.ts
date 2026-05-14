import type { RepoMeta, IndexedRepo } from './types.js';
export declare const hasKuzuIndex: (storagePath: string) => Promise<boolean>;
export declare const cleanupOldKuzuFiles: (storagePath: string) => Promise<{
    found: boolean;
    needsReindex: boolean;
}>;
export declare const loadMeta: (storagePath: string) => Promise<RepoMeta | null>;
export declare const saveMeta: (storagePath: string, meta: RepoMeta) => Promise<void>;
export declare const hasIndex: (repoPath: string) => Promise<boolean>;
export declare const loadRepo: (repoPath: string) => Promise<IndexedRepo | null>;
export declare const findRepo: (startPath: string) => Promise<IndexedRepo | null>;
