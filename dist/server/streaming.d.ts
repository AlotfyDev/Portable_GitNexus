import type express from 'express';
import type { JobManager } from './analyze-job.js';
export type GraphStreamRecord = {
    type: 'node';
    data: Record<string, unknown>;
} | {
    type: 'relationship';
    data: Record<string, unknown>;
};
export declare class ClientDisconnectedError extends Error {
    constructor();
}
export declare const isIgnorableGraphQueryError: (err: unknown) => boolean;
export declare function ensureStreamIsWritable(res: express.Response, signal?: AbortSignal): void;
export declare function waitForDrain(res: express.Response, signal?: AbortSignal): Promise<void>;
export declare function isClientDisconnectWriteError(err: unknown): boolean;
export declare function writeNdjsonRecord(res: express.Response, record: GraphStreamRecord, signal?: AbortSignal): Promise<void>;
export declare function streamGraphNdjson(res: express.Response, includeContent?: boolean, signal?: AbortSignal): Promise<void>;
export declare function mountSSEProgress(app: express.Express, routePath: string, jm: JobManager): void;
