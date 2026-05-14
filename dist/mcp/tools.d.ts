/**
 * MCP Tool Definitions
 *
 * Defines the tools that GitNexus exposes to external AI agents.
 * All tools support an optional `repo` parameter for multi-repo setups.
 */
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
export interface ToolDefinition {
    name: string;
    description: string;
    annotations: ToolAnnotations;
    inputSchema: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description?: string;
            default?: unknown;
            items?: {
                type: string;
            };
            enum?: string[];
            minimum?: number;
            maximum?: number;
            minLength?: number;
        }>;
        required: string[];
    };
}
export declare const GITNEXUS_TOOLS: ToolDefinition[];
