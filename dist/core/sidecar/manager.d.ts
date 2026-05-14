import { EventEmitter } from 'events';
import type { SidecarOptions, SidecarStatus } from './types.js';
export declare class SidecarManager extends EventEmitter {
    private readonly options;
    private process;
    private state;
    private startTime;
    private lastHealthCheck;
    private restartCount;
    private requestId;
    private pendingRequests;
    private healthTimer;
    private rl;
    constructor(options: SidecarOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    healthCheck(): Promise<boolean>;
    rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
    executeQuery(cypher: string): Promise<{
        columns: string[];
        rows: unknown[][];
    }>;
    getSchema(): Promise<{
        tables: unknown[];
    }>;
    getStatus(): SidecarStatus;
}
