import type { StateManager } from './state-manager.js';
import type { RepoHandle } from './types.js';
export declare function bm25Search(repo: RepoHandle, query: string, limit: number): Promise<{
    results: any[];
    ftsUsed: boolean;
}>;
export declare function semanticSearch(ctx: StateManager, repo: RepoHandle, query: string, limit: number): Promise<any[]>;
export declare function executeQueryTool(ctx: StateManager, repo: RepoHandle, params: {
    query: string;
    task_context?: string;
    goal?: string;
    limit?: number;
    max_symbols?: number;
    include_content?: boolean;
}): Promise<any>;
