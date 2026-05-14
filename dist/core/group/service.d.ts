/**
 * Group orchestration shared by MCP (LocalBackend) and CLI.
 * DB access is injected via GroupToolPort so this module stays free of LocalBackend private API.
 */
import type { GroupContextResult } from './types.js';
export interface GroupRepoHandle {
    id: string;
    name: string;
    repoPath: string;
    storagePath: string;
    indexedAt?: string;
    lastCommit?: string;
}
export interface GroupToolPort {
    resolveRepo(repoParam?: string): Promise<GroupRepoHandle>;
    impact(repo: GroupRepoHandle, params: {
        target: string;
        direction: 'upstream' | 'downstream';
        maxDepth?: number;
        relationTypes?: string[];
        includeTests?: boolean;
        minConfidence?: number;
    }): Promise<unknown>;
    query(repo: GroupRepoHandle, params: {
        query: string;
        task_context?: string;
        goal?: string;
        limit?: number;
        max_symbols?: number;
        include_content?: boolean;
    }): Promise<unknown>;
    impactByUid(repoId: string, uid: string, direction: string, opts: {
        maxDepth: number;
        relationTypes: string[];
        minConfidence: number;
        includeTests: boolean;
        signal?: AbortSignal;
    }): Promise<unknown | null>;
    context(repo: GroupRepoHandle, params: {
        name?: string;
        uid?: string;
        file_path?: string;
        include_content?: boolean;
    }): Promise<unknown>;
}
export declare class GroupService {
    private readonly port;
    constructor(port: GroupToolPort);
    groupList(params: Record<string, unknown>): Promise<unknown>;
    groupSync(params: Record<string, unknown>): Promise<unknown>;
    groupContracts(params: Record<string, unknown>): Promise<unknown>;
    groupImpact(params: Record<string, unknown>): Promise<unknown>;
    groupContext(params: Record<string, unknown>): Promise<GroupContextResult>;
    groupQuery(params: Record<string, unknown>): Promise<unknown>;
    groupStatus(params: Record<string, unknown>): Promise<unknown>;
}
