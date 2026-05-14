import type { WikiMeta, ModuleTreeNode, ProgressCallback } from '../types.js';
export declare function fileExists(fp: string): Promise<boolean>;
export declare function truncateSource(source: string, maxTokens: number): string;
export declare function getCurrentCommit(repoPath: string): string;
export declare function getChangedFiles(repoPath: string, fromCommit: string, toCommit: string): string[] | null;
export declare function readSourceFiles(repoPath: string, filePaths: string[]): Promise<string>;
export declare function estimateModuleTokens(repoPath: string, filePaths: string[]): Promise<number>;
export declare function readProjectInfo(repoPath: string): Promise<string>;
export declare function loadWikiMeta(wikiDir: string): Promise<WikiMeta | null>;
export declare function saveWikiMeta(wikiDir: string, meta: WikiMeta): Promise<void>;
export declare function saveModuleTree(wikiDir: string, tree: ModuleTreeNode[]): Promise<void>;
export declare function ensureHTMLViewer(wikiDir: string, repoPath: string, onProgress: ProgressCallback): Promise<void>;
export declare function runParallel<T>(items: T[], fn: (item: T) => Promise<number>, concurrency: number, onProgress: ProgressCallback, lastPercentRef: {
    value: number;
}): Promise<number>;
