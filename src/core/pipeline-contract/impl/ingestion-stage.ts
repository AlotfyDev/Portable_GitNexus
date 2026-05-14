import type { PipelineContract } from '../types.js';
import type { IngestionOutput } from '../stages.js';
import { STAGE_IDS, STAGE_RESOURCES } from '../descriptors.js';
import { pid } from '../types.js';
import { runPipelineFromRepo } from '../../ingestion/pipeline.js';
import { PHASE_LABELS } from '../../analyze/phases.js';
import { getCurrentCommit } from '../../../storage/git.js';

export function createIngestionStage(): PipelineContract<IngestionOutput> {
  return {
    id: pid(STAGE_IDS.INGESTION),
    label: 'Build Knowledge Graph',
    deps: [],
    artifact: {
      version: 1,
      compute: (ctx) => {
        if (ctx.options.force) return `force-${Date.now()}`;
        try {
          const commit = getCurrentCommit(ctx.repoPath);
          return commit || `mtime-${Date.now()}`;
        } catch {
          return `mtime-${Date.now()}`;
        }
      },
    },
    resources: STAGE_RESOURCES.ingestion.map((r) => ({
      ...r,
      check: () => ({ available: true, detail: 'Default check — override in platform-specific impl' }),
    })),
    run: async (ctx) => {
      const pipelineResult = await runPipelineFromRepo(ctx.repoPath, (p) => {
        const phaseLabel = PHASE_LABELS[p.phase] || p.phase;
        const scaled = Math.round(p.percent * 0.6);
        const message = p.detail
          ? `${p.message || phaseLabel} (${p.detail})`
          : p.message || phaseLabel;
        ctx.progress(p.phase, scaled, message);
      });
      return { graph: pipelineResult.graph, repoPath: pipelineResult.repoPath };
    },
  };
}
