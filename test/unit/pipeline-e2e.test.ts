/**
 * E2E Test: PipelineContract Integration with Embeddings + LadybugDB
 *
 * Tests the full pipeline on real C++ source files using the PipelineRunner.
 * Verifies: ingestion → LadybugDB → search → embeddings → finalize.
 *
 * This is the SAME path used by both portable and non-portable editions.
 */
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, it, expect } from 'vitest';
import { getStoragePaths, loadMeta } from '../../src/storage/repo-manager.js';
import type { AnalyzeResult, AnalyzeCallbacks } from '../../src/core/analyze/types.js';

const TEST_TIMEOUT = 300_000; // 5 min for model loading + embedding

async function copyFile(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

const SAMPLE_FILE = 'D:/Agent_Skills/Test_Samples_For_Portable_GitNexus/assembler/circulation_mechanism/ids/TBoundaryId.hpp';

async function createTempDir(prefix: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return tmpDir;
}

async function cleanupTempDir(tmpDir: string): Promise<void> {
  try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
}

describe('PipelineContract E2E — full analysis with embeddings', () => {
  it('runs 5-stage PipelineRunner on real C++ code and produces embeddings', async () => {
    let tmpDir = '';
    try {
      // ── 1. Setup: temp repo with C++ sample files ───────────────
      tmpDir = await createTempDir('gitnexus-e2e-embeddings-');
      await copyFile(SAMPLE_FILE, path.join(tmpDir, 'TBoundaryId.hpp'));

      // Git init + first commit
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git -c user.name=test -c user.email=test@test add -A', {
        cwd: tmpDir, stdio: 'pipe', timeout: 30_000,
      });
      execSync('git -c user.name=test -c user.email=test@test commit -m "initial"', {
        cwd: tmpDir, stdio: 'pipe', timeout: 30_000,
      });

      // ── 2. Verify clean state (no existing meta) ─────────────────
      const { storagePath } = getStoragePaths(tmpDir);
      let meta = await loadMeta(storagePath);
      expect(meta).toBeNull(); // first run, no meta

      // ── 3. Run FULL analysis with embeddings ─────────────────────
      const { runFullAnalysis } = await import('../../src/core/run-analyze.js');

      const progressLog: Array<{ phase: string; pct: number; msg: string }> = [];

      const result: AnalyzeResult = await runFullAnalysis(
        tmpDir,
        { embeddings: true, embeddingsNodeLimit: 0 },
        {
          onLog: (msg: string) => { console.log(`[LOG] ${msg}`); },
          onProgress: (phase: string, pct: number, msg: string) => {
            progressLog.push({ phase, pct, msg });
          },
        },
      );

      // ── 4. Verify pipeline results ───────────────────────────────
      expect(result.alreadyUpToDate).toBeUndefined(); // not a fast-path
      expect(result.repoPath).toBe(tmpDir);
      expect(result.stats).toBeDefined();

      // Nodes were extracted from C++ files
      expect(result.stats.nodes).toBeGreaterThan(0);
      console.log(`Nodes: ${result.stats.nodes}, Edges: ${result.stats.edges}`);

      // Embeddings were generated
      expect(result.stats.embeddings).toBeGreaterThan(0);
      console.log(`Embeddings: ${result.stats.embeddings}`);

      // ── 5. Verify meta.json on disk ──────────────────────────────
      meta = await loadMeta(storagePath);
      expect(meta).not.toBeNull();
      expect(meta!.stats.embeddings).toBeGreaterThan(0);
      console.log(`meta.json embeddings: ${meta!.stats.embeddings}`);

      // ── 6. Verify progress coverage (all 5 stages reported) ──────
      const phases = new Set(progressLog.map(p => p.phase));
      expect(phases.has('parsing')).toBe(true);   // from ingestion
      expect(phases.has('lbug')).toBe(true);       // ladybugdb
      expect(phases.has('fts')).toBe(true);        // search
      expect(phases.has('embeddings')).toBe(true); // embeddings
      expect(phases.has('done')).toBe(true);       // finalize

      // Progress went to 100%
      const lastProgress = progressLog[progressLog.length - 1];
      expect(lastProgress.pct).toBe(100);
      expect(lastProgress.msg).toBe('Done');

    } finally {
      if (tmpDir) await cleanupTempDir(tmpDir);
    }
  }, TEST_TIMEOUT);

  it('skip mode: graph up-to-date, only embeddings regenerate', async () => {
    let tmpDir = '';
    try {
      // ── 1. First run: full analysis ──────────────────────────────
      tmpDir = await createTempDir('gitnexus-e2e-skip-');
      await copyFile(SAMPLE_FILE, path.join(tmpDir, 'TBoundaryId.hpp'));

      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git -c user.name=test -c user.email=test@test add -A', {
        cwd: tmpDir, stdio: 'pipe', timeout: 30_000,
      });
      execSync('git -c user.name=test -c user.email=test@test commit -m "initial"', {
        cwd: tmpDir, stdio: 'pipe', timeout: 30_000,
      });

      const { runFullAnalysis } = await import('../../src/core/run-analyze.js');
      const callbacks: AnalyzeCallbacks = { onLog: () => {}, onProgress: () => {} };

      // First run: full with embeddings
      const firstResult = await runFullAnalysis(tmpDir, { embeddings: true }, callbacks);
      expect(firstResult.stats.embeddings).toBeGreaterThan(0);
      const firstCommit = (await loadMeta(getStoragePaths(tmpDir).storagePath))!.lastCommit;

      // ── 2. Second run: same commit, but embeddings already exist ─
      // Should take the early-return fast path
      const secondResult = await runFullAnalysis(tmpDir, { embeddings: true }, callbacks);
      expect(secondResult.alreadyUpToDate).toBe(true);
      const secondMeta = await loadMeta(getStoragePaths(tmpDir).storagePath);
      expect(secondMeta!.lastCommit).toBe(firstCommit);

      // Embeddings preserved
      expect(secondMeta!.stats.embeddings).toBeGreaterThan(0);

      console.log('Skip mode verified: early return on up-to-date graph');
      console.log(`First: ${firstResult.stats.embeddings} emb, Second: ${secondMeta!.stats.embeddings} emb`);

    } finally {
      if (tmpDir) await cleanupTempDir(tmpDir);
    }
  }, TEST_TIMEOUT);
});
