import type { RegistryEntry } from '../../../storage/repo-manager.js';
export interface CodebaseContext {
    projectName: string;
    stats: {
        fileCount: number;
        functionCount: number;
        communityCount: number;
        processCount: number;
    };
}
export interface RepoHandle {
    id: string;
    name: string;
    repoPath: string;
    storagePath: string;
    lbugPath: string;
    indexedAt: string;
    lastCommit: string;
    remoteUrl?: string;
    stats?: RegistryEntry['stats'];
}
