/**
 * Shared Analysis Orchestrator
 *
 * Thin coordinator that composes independent analysis phases.
 * All phase logic lives in dedicated modules imported below.
 *
 * IMPORTANT: This module must NEVER call process.exit(). The caller (CLI
 * wrapper or server worker) is responsible for process lifecycle.
 */

import path from 'path';
import {
  initLbug,
  closeLbug,
} from './lbug/lbug-adapter.js';
import {
  getStoragePaths,
  loadMeta,
  ensureGitNexusIgnored,
  cleanupOldKuzuFiles,
} from '../storage/repo-manager.js';
import {
  getCurrentCommit,
  hasGitDir,
  getInferredRepoName,
  resolveRepoIdentityRoot,
} from '../storage/git.js';
import type { PipelineContext, PipelineId, PipelineContract } from './pipeline-contract/index.js';
import {
  createPipelineRunner,
  pid,
  STAGE_IDS,
  createIngestionStage,
  createLadybugStage,
  createSearchStage,
  createEmbeddingStage,
  createFinalizeStage,
} from './pipeline-contract/index.js';
import { ConfigProviderRegistry } from './config/registry.js';
import { resolve as resolvePath } from 'path';

export type { AnalyzeOptions, AnalyzeResult, AnalyzeCallbacks } from './analyze/types.js';
export { PHASE_LABELS } from './analyze/phases.js';

export async function runFullAnalysis(
  repoPath: string,
  options: import('./analyze/types.js').AnalyzeOptions,
  callbacks: import('./analyze/types.js').AnalyzeCallbacks,
): Promise<import('./analyze/types.js').AnalyzeResult> {
  const log = (msg: string) => callbacks.onLog?.(msg);
  const progress = (phase: string, percent: number, message: string) =>
    callbacks.onProgress(phase, percent, message);

  // Allow config output_path to override where .gitnexus/ lives
  const config = ConfigProviderRegistry.get().getConfig();
  const effectiveStoragePath = config?.output_path
    ? resolvePath(repoPath, config.output_path)
    : undefined;
  const { storagePath, lbugPath } = effectiveStoragePath
    ? { storagePath: effectiveStoragePath, lbugPath: path.join(effectiveStoragePath, 'lbug') }
    : getStoragePaths(repoPath);

  const kuzuResult = await cleanupOldKuzuFiles(storagePath);
  if (kuzuResult.found && kuzuResult.needsReindex) {
    log('Migrating from KuzuDB to LadybugDB — rebuilding index...');
  }

  const repoHasGit = hasGitDir(repoPath);
  const currentCommit = repoHasGit ? getCurrentCommit(repoPath) : '';
  const existingMeta = await loadMeta(storagePath);

  // ── Early-return: already up to date ──────────────────────────────
  if (existingMeta && !options.force && existingMeta.lastCommit === currentCommit) {
    if (currentCommit !== '') {
      const existingEmbeddings = existingMeta.stats?.embeddings ?? 0;
      const needsEmbeddings = !!options.embeddings && existingEmbeddings === 0;
      if (!needsEmbeddings) {
        await ensureGitNexusIgnored(repoPath);
        return {
          repoName:
            options.registryName ??
            getInferredRepoName(repoPath) ??
            path.basename(resolveRepoIdentityRoot(repoPath)),
          repoPath,
          stats: existingMeta.stats ?? {},
          alreadyUpToDate: true,
        };
      }
    }
  }

  // ── Build PipelineContext and Runner ──────────────────────────────────
  const ctx: PipelineContext = {
    repoPath,
    storagePath,
    lbugPath,
    options,
    callbacks,
    results: new Map(),
    tempDir: path.join(storagePath, '.temp'),
    config: ConfigProviderRegistry.get(),
    log: (msg: string) => callbacks.onLog?.(msg),
    progress: (phase: string, percent: number, message: string) =>
      callbacks.onProgress(phase, percent, message),
  };

  const contracts: Map<PipelineId, PipelineContract> = new Map();
  contracts.set(pid(STAGE_IDS.INGESTION), createIngestionStage());
  contracts.set(pid(STAGE_IDS.LADYBUGDB), createLadybugStage());
  contracts.set(pid(STAGE_IDS.SEARCH), createSearchStage());
  contracts.set(pid(STAGE_IDS.EMBEDDINGS), createEmbeddingStage());
  contracts.set(pid(STAGE_IDS.FINALIZE), createFinalizeStage());
  const runner = createPipelineRunner(contracts);

  // Determine skip set: when graph is up-to-date but embeddings are missing
  const skipSet = new Set<PipelineId>();
  if (existingMeta && !options.force && existingMeta.lastCommit === currentCommit) {
    const existingEmbeddings = existingMeta.stats?.embeddings ?? 0;
    if (!!options.embeddings && existingEmbeddings === 0) {
      log(`Graph is up-to-date; generating embeddings for ${existingMeta.stats?.nodes?.toLocaleString() ?? '?'} nodes...`);
      skipSet.add(pid(STAGE_IDS.INGESTION));
      skipSet.add(pid(STAGE_IDS.LADYBUGDB));
      skipSet.add(pid(STAGE_IDS.SEARCH));
    }
  }

  // Open LadybugDB (needed when LB stage is skipped — embeddingsOnly mode)
  await initLbug(lbugPath);

  // ── Run pipeline ──────────────────────────────────────────────────────
  const report = await runner.runPipelines(ctx, {
    force: options.force,
    skip: skipSet.size > 0 ? [...skipSet] : undefined,
    failFast: true,
  });

  if (report.failed.length > 0) {
    try { await closeLbug(); } catch { /* ok */ }
    throw new Error(`Pipeline stage(s) failed: ${report.failed.join(', ')}`);
  }

  // ── Extract result ────────────────────────────────────────────────────
  const finalizeOutput = report.results.get(pid(STAGE_IDS.FINALIZE))?.output as import('./analyze/types.js').AnalyzeResult | undefined;
  if (finalizeOutput) return finalizeOutput;

  // Fallback
  await closeLbug();
  return {
    repoName: options.registryName ?? getInferredRepoName(repoPath) ?? path.basename(resolveRepoIdentityRoot(repoPath)),
    repoPath,
    stats: existingMeta?.stats ?? {},
    alreadyUpToDate: true,
  };
}
