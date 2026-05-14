import type { RepoHandle } from './types.js';
export declare function _contextImpl(repo: RepoHandle, params: {
    name?: string;
    uid?: string;
    file_path?: string;
    kind?: string;
    include_content?: boolean;
}): Promise<any>;
export declare function executeContext(repo: RepoHandle, params: {
    name?: string;
    uid?: string;
    file_path?: string;
    kind?: string;
    include_content?: boolean;
}): Promise<any>;
export declare function executeCypher(repo: RepoHandle, params: {
    query: string;
}): Promise<any>;
export declare function formatCypherAsMarkdown(result: any): any;
export declare function executeOverview(repo: RepoHandle, params: {
    showClusters?: boolean;
    showProcesses?: boolean;
    limit?: number;
}): Promise<any>;
export declare function executeExplore(repo: RepoHandle, params: {
    name: string;
    type: 'symbol' | 'cluster' | 'process';
}): Promise<any>;
