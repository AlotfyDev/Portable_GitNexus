import { type LLMConfig } from '../llm-client.js';
import type { WikiOptions, ProgressCallback, WikiRunResult } from './types.js';
export declare class WikiGenerator {
    private repoPath;
    private storagePath;
    private wikiDir;
    private lbugPath;
    private llmConfig;
    private maxTokensPerModule;
    private concurrency;
    private options;
    private onProgress;
    private failedModules;
    private lastPercent;
    constructor(repoPath: string, storagePath: string, lbugPath: string, llmConfig: LLMConfig, options?: WikiOptions, onProgress?: ProgressCallback);
    private streamOpts;
    private invokeLLM;
    run(): Promise<WikiRunResult>;
    private fullGeneration;
    private buildModuleTree;
    private incrementalUpdate;
}
