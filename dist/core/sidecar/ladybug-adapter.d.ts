import { SidecarManager } from './manager.js';
export declare class LadybugSidecar {
    private readonly manager;
    constructor(manager: SidecarManager);
    static create(dbPath?: string): Promise<LadybugSidecar>;
    query(cypher: string): Promise<{
        columns: string[];
        rows: unknown[][];
    }>;
    health(): Promise<boolean>;
    getStatus(): import("./types.js").SidecarStatus;
    dispose(): Promise<void>;
}
