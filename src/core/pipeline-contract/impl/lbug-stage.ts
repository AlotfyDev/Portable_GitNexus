import fs from 'fs/promises';
import type { PipelineContract } from '../types.js';
import { STAGE_IDS, STAGE_RESOURCES } from '../descriptors.js';
import { pid } from '../types.js';
import {
  initLbug,
  closeLbug,
  loadGraphToLbug,
} from '../../lbug/lbug-adapter.js';

export function createLadybugStage(): PipelineContract<void> {
  return {
    id: pid(STAGE_IDS.LADYBUGDB),
    label: 'Load into LadybugDB',
    deps: [pid(STAGE_IDS.INGESTION)],
    artifact: {
      version: 1,
      compute: (ctx) => {
        const ingestion = ctx.results.get(pid(STAGE_IDS.INGESTION)) as
          | { graph: unknown }
          | undefined;
        return ingestion ? `graph-${Date.now()}` : 'stale';
      },
    },
    resources: STAGE_RESOURCES.ladybugdb.map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    run: async (ctx) => {
      const ingestion = ctx.results.get(pid(STAGE_IDS.INGESTION)) as
        | { graph: unknown; repoPath: string }
        | undefined;
      if (!ingestion) throw new Error('LadybugDB stage requires ingestion results');

      await closeLbug();
      const lbugFiles = [ctx.lbugPath, `${ctx.lbugPath}.wal`, `${ctx.lbugPath}.lock`];
      for (const f of lbugFiles) {
        try {
          await fs.rm(f, { recursive: true, force: true });
        } catch {
          /* ok */
        }
      }

      await initLbug(ctx.lbugPath);
      let lbugMsgCount = 0;
      await loadGraphToLbug(
        ingestion.graph as any,
        ingestion.repoPath,
        ctx.storagePath,
        (msg) => {
          lbugMsgCount++;
          const pct = Math.min(
            84,
            60 + Math.round((lbugMsgCount / (lbugMsgCount + 10)) * 24),
          );
          ctx.progress('lbug', pct, msg);
        },
      );
    },
  };
}
