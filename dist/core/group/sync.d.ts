import { type RegistryEntry } from '../../storage/repo-manager.js';
import type { GroupConfig, RepoHandle, RepoSnapshot, StoredContract, CrossLink } from './types.js';
export interface SyncOptions {
    extractorOverride?: ((repo: RepoHandle) => Promise<StoredContract[]>) | (() => Promise<StoredContract[]>);
    resolveRepoHandle?: (registryName: string, groupPath: string) => Promise<RepoHandle | null>;
    skipWrite?: boolean;
    groupDir?: string;
    allowStale?: boolean;
    verbose?: boolean;
    exactOnly?: boolean;
    skipEmbeddings?: boolean;
}
export interface SyncResult {
    contracts: StoredContract[];
    crossLinks: CrossLink[];
    unmatched: StoredContract[];
    missingRepos: string[];
    repoSnapshots: Record<string, RepoSnapshot>;
}
export declare function stableRepoPoolId(entry: RegistryEntry, allEntries: RegistryEntry[]): string;
export declare function syncGroup(config: GroupConfig, opts?: SyncOptions): Promise<SyncResult>;
