/**
 * C# namespace import resolution — internal helpers.
 *
 * Strategy lives in configs/csharp.ts.
 * This file contains shared helpers for namespace-based resolution.
 */
import type { SuffixIndex } from './utils.js';
import type { CSharpProjectConfig } from '../language-config.js';
/**
 * Resolve a C# using-directive import path to matching .cs files (low-level helper).
 * Tries single-file match first, then directory match for namespace imports.
 */
export declare function resolveCSharpImportInternal(importPath: string, csharpConfigs: CSharpProjectConfig[], normalizedFileList: string[], allFileList: string[], index?: SuffixIndex): string[];
/**
 * Compute the directory suffix for a C# namespace import (for PackageMap).
 * Returns a suffix like "/ProjectDir/Models/" or null if no config matches.
 */
export declare function resolveCSharpNamespaceDir(importPath: string, csharpConfigs: CSharpProjectConfig[]): string | null;
