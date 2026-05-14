import { type CallLLMOptions } from '../../llm-client.js';
import type { ModuleTreeNode } from '../types.js';
export interface PageGenDeps {
    wikiDir: string;
    repoPath: string;
    maxTokensPerModule: number;
    invokeLLM: (prompt: string, systemPrompt: string, options?: CallLLMOptions) => Promise<import('../../llm-client.js').LLMResponse>;
    streamOpts: (label: string, fixedPercent?: number, percentRange?: number) => CallLLMOptions;
}
export declare function generateLeafPage(node: ModuleTreeNode, deps: PageGenDeps): Promise<void>;
export declare function generateParentPage(node: ModuleTreeNode, deps: PageGenDeps): Promise<void>;
export declare function generateOverview(moduleTree: ModuleTreeNode[], deps: PageGenDeps): Promise<void>;
