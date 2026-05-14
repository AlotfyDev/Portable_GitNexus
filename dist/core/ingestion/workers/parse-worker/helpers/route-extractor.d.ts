import { Tree } from 'web-tree-sitter';
import type { ExtractedRoute } from '../types.js';
export declare function extractLaravelRoutes(tree: Tree, filePath: string): ExtractedRoute[];
