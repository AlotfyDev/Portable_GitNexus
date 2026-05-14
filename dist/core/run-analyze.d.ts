/**
 * Shared Analysis Orchestrator
 *
 * Thin coordinator that composes independent analysis phases.
 * All phase logic lives in dedicated modules imported below.
 *
 * IMPORTANT: This module must NEVER call process.exit(). The caller (CLI
 * wrapper or server worker) is responsible for process lifecycle.
 */
import type { PortableConfig } from '../config/types.js';
export type { AnalyzeOptions, AnalyzeResult, AnalyzeCallbacks } from './analyze/types.js';
export { PHASE_LABELS } from './analyze/phases.js';
export declare function runFullAnalysis(repoPath: string, options: import('./analyze/types.js').AnalyzeOptions, callbacks: import('./analyze/types.js').AnalyzeCallbacks, portableConfig?: PortableConfig): Promise<import('./analyze/types.js').AnalyzeResult>;
