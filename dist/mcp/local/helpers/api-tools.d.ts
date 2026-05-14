import type { RepoHandle } from './types.js';
export declare function executeRouteMap(repo: RepoHandle, params: {
    route?: string;
}): Promise<any>;
export declare function executeShapeCheck(repo: RepoHandle, params: {
    route?: string;
}): Promise<any>;
export declare function executeToolMap(repo: RepoHandle, params: {
    tool?: string;
}): Promise<any>;
export declare function executeApiImpact(repo: RepoHandle, params: {
    route?: string;
    file?: string;
}): Promise<any>;
