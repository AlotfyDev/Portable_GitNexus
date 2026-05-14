import { Router } from 'express';
import type { ServerDependencies } from '../types.js';
export declare const handleFileRequest: (req: {
    query: any;
}, res: {
    status: (code: number) => {
        json: (body: any) => void;
    };
    json: (body: any) => void;
}, repoPath: string) => Promise<void>;
export declare function mountFile(router: Router, deps: ServerDependencies): void;
