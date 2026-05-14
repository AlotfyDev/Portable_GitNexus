import type { FileWithExports } from '../../graph-queries.js';
import type { ModuleTreeNode } from '../types.js';
export declare function slugify(name: string): string;
export declare function parseGroupingResponse(content: string, files: FileWithExports[]): Record<string, string[]>;
export declare function fallbackGrouping(files: FileWithExports[]): Record<string, string[]>;
export declare function splitBySubdirectory(moduleName: string, files: string[]): ModuleTreeNode[];
export declare function extractModuleFiles(tree: ModuleTreeNode[]): Record<string, string[]>;
export declare function countModules(tree: ModuleTreeNode[]): number;
export declare function flattenModuleTree(tree: ModuleTreeNode[]): {
    leaves: ModuleTreeNode[];
    parents: ModuleTreeNode[];
};
export declare function findNodeBySlug(tree: ModuleTreeNode[], slug: string): ModuleTreeNode | null;
