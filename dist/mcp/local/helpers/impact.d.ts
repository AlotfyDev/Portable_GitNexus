import type { StateManager } from './state-manager.js';
import type { RepoHandle } from './types.js';
declare function _runImpactBFS(repo: RepoHandle, sym: any, symType: string, direction: 'upstream' | 'downstream', opts: {
    maxDepth: number;
    relationTypes: string[];
    includeTests: boolean;
    minConfidence: number;
}): Promise<any>;
export declare function executeImpact(repo: RepoHandle, params: {
    target: string;
    target_uid?: string;
    file_path?: string;
    kind?: string;
    direction: 'upstream' | 'downstream';
    maxDepth?: number;
    relationTypes?: string[];
    includeTests?: boolean;
    minConfidence?: number;
}): Promise<any>;
export declare function executeImpactByUid(ctx: StateManager, repoId: string, uid: string, direction: string, opts: {
    maxDepth: number;
    relationTypes: string[];
    minConfidence: number;
    includeTests: boolean;
    signal?: AbortSignal;
}): Promise<any | null>;
export { _runImpactBFS };
