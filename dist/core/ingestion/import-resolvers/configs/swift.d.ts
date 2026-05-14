/**
 * Swift import resolution config.
 * Package.swift target map strategy — no standard fallback (unresolved = external framework).
 */
import type { ImportResolutionConfig, ImportResolverStrategy } from '../types.js';
/** Swift Package.swift target map resolution strategy. */
export declare const swiftPackageStrategy: ImportResolverStrategy;
export declare const swiftImportConfig: ImportResolutionConfig;
