import type { RepoHandle } from './types.js';
export declare function executeRename(repo: RepoHandle, params: {
    symbol_name?: string;
    symbol_uid?: string;
    new_name: string;
    file_path?: string;
    dry_run?: boolean;
}): Promise<any>;
