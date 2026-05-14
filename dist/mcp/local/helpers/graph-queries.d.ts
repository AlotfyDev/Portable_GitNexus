import type { RepoHandle } from './types.js';
export declare function queryClusters(repo: RepoHandle, limit?: number): Promise<{
    clusters: any[];
}>;
export declare function queryProcesses(repo: RepoHandle, limit?: number): Promise<{
    processes: any[];
}>;
export declare function queryClusterDetail(repo: RepoHandle, name: string): Promise<any>;
export declare function queryProcessDetail(repo: RepoHandle, name: string): Promise<any>;
