/**
 * Local Backend (Multi-Repo)
 *
 * Thin orchestration layer that delegates to helper modules.
 * Provides MCP tool implementations using local .gitnexus/ indexes.
 */
export { isWriteQuery } from '../../core/lbug/pool-adapter.js';
export { isTestFilePath, VALID_NODE_LABELS, VALID_RELATION_TYPES, IMPACT_RELATION_CONFIDENCE } from './helpers/constants.js';
export type { CodebaseContext } from './helpers/types.js';
import type { RepoHandle } from './helpers/types.js';
export declare class LocalBackend {
    private ctx;
    init(): Promise<boolean>;
    dispose(): Promise<void>;
    resolveRepo(repoParam?: string): Promise<RepoHandle>;
    getContext(repoId?: string): import("./helpers/types.js").CodebaseContext;
    listRepos(): Promise<{
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
    }[]>;
    getGroupService(): import("../../core/group/service.js").GroupService;
    callTool(method: string, params: any): Promise<any>;
    executeCypher(repoName: string, query: string): Promise<any>;
    readGroupContractsResource(groupName: string, filter: {
        type?: string;
        repo?: string;
        unmatchedOnly?: boolean;
    }): Promise<string>;
    readGroupStatusResource(groupName: string): Promise<string>;
    queryClusters(repoName?: string, limit?: number): Promise<{
        clusters: any[];
    }>;
    queryProcesses(repoName?: string, limit?: number): Promise<{
        processes: any[];
    }>;
    queryClusterDetail(name: string, repoName?: string): Promise<any>;
    queryProcessDetail(name: string, repoName?: string): Promise<any>;
    impactByUid(repoId: string, uid: string, direction: string, opts: {
        maxDepth: number;
        relationTypes: string[];
        minConfidence: number;
        includeTests: boolean;
        signal?: AbortSignal;
    }): Promise<any | null>;
    disconnect(): Promise<void>;
    private impact;
    private query;
    private context;
}
