/**
 * Go package import resolution — internal helpers.
 *
 * Strategy lives in configs/go.ts.
 * This file contains the shared helpers used by the strategy.
 */
import type { GoModuleConfig } from '../language-config.js';
/**
 * Extract the package directory suffix from a Go import path.
 * Returns the suffix string (e.g., "/internal/auth/") or null if invalid.
 */
export declare function resolveGoPackageDir(importPath: string, goModule: GoModuleConfig): string | null;
/**
 * Resolve a Go internal package import to all .go files in the package directory.
 * Returns an array of file paths.
 */
export declare function resolveGoPackage(importPath: string, goModule: GoModuleConfig, normalizedFileList: string[], allFileList: string[]): string[];
