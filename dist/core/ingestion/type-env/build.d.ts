import { type SyntaxNode } from '../utils/ast-helpers.js';
import { SupportedLanguages } from '../../../_shared/index.js';
import type { BuildTypeEnvOptions, TypeEnvironment } from './types.js';
export declare const buildTypeEnv: (tree: {
    rootNode: SyntaxNode;
}, language: SupportedLanguages, options?: BuildTypeEnvOptions) => TypeEnvironment;
