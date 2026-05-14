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
import { initLbug, closeLbug, } from './lbug/lbug-adapter.js';
import { getStoragePaths, loadMeta, ensureGitNexusIgnored, cleanupOldKuzuFiles, } from '../storage/repo-manager.js';
import { getCurrentCommit, hasGitDir, getInferredRepoName, resolveRepoIdentityRoot, } from '../storage/git.js';
import { createPipelineRunner, pid, STAGE_IDS, createIngestionStage, createLadybugStage, createSearchStage, createEmbeddingStage, createFinalizeStage, } from './pipeline-contract/index.js';
import { resolve as resolvePath } from 'path';
export { PHASE_LABELS } from './analyze/phases.js';
export async function runFullAnalysis(repoPath, options, callbacks, portableConfig) {
    const log = (msg) => callbacks.onLog?.(msg);
    const progress = (phase, percent, message) => callbacks.onProgress(phase, percent, message);
    // Allow config output_path to override where .gitnexus/ lives
    const effectiveStoragePath = portableConfig?.output_path
        ? resolvePath(repoPath, portableConfig.output_path)
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
                    repoName: options.registryName ??
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
    const ctx = {
        repoPath,
        storagePath,
        lbugPath,
        options,
        callbacks,
        results: new Map(),
        tempDir: path.join(storagePath, '.temp'),
        config: portableConfig,
        log: (msg) => callbacks.onLog?.(msg),
        progress: (phase, percent, message) => callbacks.onProgress(phase, percent, message),
    };
    const contracts = new Map();
    contracts.set(pid(STAGE_IDS.INGESTION), createIngestionStage());
    contracts.set(pid(STAGE_IDS.LADYBUGDB), createLadybugStage());
    contracts.set(pid(STAGE_IDS.SEARCH), createSearchStage());
    contracts.set(pid(STAGE_IDS.EMBEDDINGS), createEmbeddingStage());
    contracts.set(pid(STAGE_IDS.FINALIZE), createFinalizeStage());
    const runner = createPipelineRunner(contracts);
    // Determine skip set: when graph is up-to-date but embeddings are missing
    const skipSet = new Set();
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
        try {
            await closeLbug();
        }
        catch { /* ok */ }
        throw new Error(`Pipeline stage(s) failed: ${report.failed.join(', ')}`);
    }
    // ── Extract result ────────────────────────────────────────────────────
    const finalizeOutput = report.results.get(pid(STAGE_IDS.FINALIZE))?.output;
    if (finalizeOutput)
        return finalizeOutput;
    // Fallback
    await closeLbug();
    return {
        repoName: options.registryName ?? getInferredRepoName(repoPath) ?? path.basename(resolveRepoIdentityRoot(repoPath)),
        repoPath,
        stats: existingMeta?.stats ?? {},
        alreadyUpToDate: true,
    };
}
