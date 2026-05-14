/**
 * Quick diagnostic: query all distinct node labels in the test repo
 * to determine why embeddings produce 0 results despite 32 nodes.
 */
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, it, expect } from 'vitest';
import { getStoragePaths } from '../../src/storage/repo-manager.js';

const SAMPLE_DIR = 'D:/Agent_Skills/Test_Samples_For_Portable_GitNexus/assembler/circulation_mechanism';
const TEST_TIMEOUT = 120_000;

describe('Diagnostic: LadybugDB node labels', () => {
  it('reports all distinct node labels after ingestion', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitnexus-diag-'));
    try {
      // Copy .hpp files
      const entries = await fs.readdir(SAMPLE_DIR, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && (e.name.endsWith('.hpp') || e.name.endsWith('.h')))
          await fs.copyFile(path.join(SAMPLE_DIR, e.name), path.join(tmpDir, e.name));
      }

      // Git init
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git -c user.name=t -c user.email=t@t add -A', { cwd: tmpDir, stdio: 'pipe', timeout: 15_000 });
      execSync('git -c user.name=t -c user.email=t@t commit -m "init"', { cwd: tmpDir, stdio: 'pipe', timeout: 15_000 });

      // RunFullAnalysis WITHOUT embeddings (just to build graph + LadybugDB)
      const { runFullAnalysis } = await import('../../src/core/run-analyze.js');
      await runFullAnalysis(tmpDir, {}, { onProgress: () => {} });

      // Query distinct labels from LadybugDB
      const { executeQuery, initLbug } = await import('../../src/core/lbug/lbug-adapter.js');
      const { storagePath } = getStoragePaths(tmpDir);

      // Find lbug path
      const meta = JSON.parse(await fs.readFile(path.join(storagePath, 'meta.json'), 'utf-8'));
      const dirs = await fs.readdir(tmpDir);
      const gitnexusDir = path.join(tmpDir, '.gitnexus');
      const subDirs = await fs.readdir(gitnexusDir);
      const lbugDir = subDirs.find(d => d !== 'meta.json' && d !== '.gitignore' && d !== '.temp')!;
      const lbugPath = path.join(gitnexusDir, lbugDir, 'lbug.lb');

      await initLbug(lbugPath);

      // Get ALL node labels (Cypher MATCH with label function)
      const labelResult = await executeQuery(
        `MATCH (n) RETURN DISTINCT labels(n)[0] AS label, count(n) AS cnt ORDER BY cnt DESC`,
      );

      console.log('\n=== LadybugDB Node Labels ===');
      for (const row of labelResult) {
        const label = row.label ?? row[0];
        const cnt = row.cnt ?? row[1];
        const embeddable = ['Function','Method','Constructor','Class','Interface','Struct','Enum','Trait','Impl','Macro','Namespace','TypeAlias','Typedef','Const','Property','Record','Union','Static','Variable'].includes(label);
        console.log(`  ${embeddable ? '✅' : '❌'} ${label}: ${cnt} nodes`);
      }

      const { closeLbug } = await import('../../src/core/lbug/lbug-adapter.js');
      await closeLbug();

    } finally {
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { }
    }
  }, TEST_TIMEOUT);
});
