import type { StateManager } from './state-manager.js';
export declare function dispatchGroupTool(ctx: StateManager, method: string, params: Record<string, unknown>): Promise<unknown>;
export declare function callToolAtGroupRepo(ctx: StateManager, method: string, params: Record<string, unknown>): Promise<unknown>;
export declare function readGroupContractsResource(ctx: StateManager, groupName: string, filter: {
    type?: string;
    repo?: string;
    unmatchedOnly?: boolean;
}): Promise<string>;
export declare function readGroupStatusResource(ctx: StateManager, groupName: string): Promise<string>;
