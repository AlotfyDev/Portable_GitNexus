import type { Server } from 'http';
import type { LocalBackend } from '../mcp/local/local-backend.js';
export interface ShutdownOptions {
    backend?: LocalBackend;
    jobManager?: {
        dispose(): void | Promise<void>;
    };
    embedJobManager?: {
        dispose(): void | Promise<void>;
    };
    cleanupMcp?: () => Promise<void>;
    timeoutMs?: number;
}
export declare function registerGracefulShutdown(server: Server, options: ShutdownOptions): void;
