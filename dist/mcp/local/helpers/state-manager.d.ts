import { GroupService } from '../../../core/group/service.js';
import type { CodebaseContext, RepoHandle } from './types.js';
export interface ToolHooks {
    impact: (repo: RepoHandle, params: any) => Promise<any>;
    query: (repo: RepoHandle, params: any) => Promise<any>;
    impactByUid: (repoId: string, uid: string, direction: string, opts: any) => Promise<any>;
    context: (repo: RepoHandle, params: any) => Promise<any>;
}
export declare class StateManager {
    repos: Map<string, RepoHandle>;
    contextCache: Map<string, CodebaseContext>;
    initializedRepos: Set<string>;
    reinitPromises: Map<string, Promise<void>>;
    lastStalenessCheck: Map<string, number>;
    groupToolSvc: GroupService | null;
    warnedSiblingDrift: Set<string>;
    warnedVectorUnsupported: boolean;
    getGroupService(hooks: ToolHooks): GroupService;
    dispose(): Promise<void>;
    init(): Promise<boolean>;
    refreshRepos(): Promise<void>;
    private repoId;
    resolveRepo(repoParam?: string): Promise<RepoHandle>;
    private resolveRepoFromCache;
    ensureInitialized(repoId: string): Promise<void>;
    getContext(repoId?: string): CodebaseContext | null;
    listRepos(): Promise<Array<{
        name: string;
        path: string;
        indexedAt: string;
        lastCommit: string;
        remoteUrl?: string;
        stats?: any;
        staleness?: {
            commitsBehind: number;
            hint?: string;
        };
        siblings?: Array<{
            name: string;
            path: string;
            lastCommit: string;
        }>;
    }>>;
    private maybeWarnSiblingDrift;
    disconnect(): Promise<void>;
}
