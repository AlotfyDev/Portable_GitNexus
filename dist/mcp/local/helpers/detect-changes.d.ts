import type { RepoHandle } from './types.js';
export declare function executeDetectChanges(repo: RepoHandle, params: {
    scope?: string;
    base_ref?: string;
}): Promise<any>;
