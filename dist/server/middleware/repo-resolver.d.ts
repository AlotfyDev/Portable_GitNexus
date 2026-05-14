import type { Request } from 'express';
import type { LocalBackend } from '../../mcp/local/local-backend.js';
export declare function createRepoResolver(backend: LocalBackend, jobManager: {
    listJobs(): any[];
    getJob(id: string): any;
}, holdTimeoutMs: number): (repoName?: string, isRetry?: boolean, req?: any) => Promise<any>;
export declare function createRepoLockManager(activeRepoPaths: Set<string>): {
    acquireRepoLock: (repoPath: string) => string | null;
    releaseRepoLock: (repoPath: string) => void;
};
export declare const requestedRepo: (req: Request) => string | undefined;
