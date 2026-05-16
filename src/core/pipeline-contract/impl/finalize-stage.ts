import path from 'path';
import type { PipelineContract } from '../types.js';
import type { EmbeddingResult } from '../stages.js';
import { STAGE_IDS, STAGE_RESOURCES } from '../descriptors.js';
import { pid } from '../types.js';
import type { AnalyzeResult } from '../../analyze/types.js';
import {
  countEmbeddings,
  buildMeta,
} from '../../analyze/finalizer.js';
import { createDatabaseProvider } from '../../config/database-config.js';
import { loadMeta } from '../../../storage/repo-manager.js';
import { getCurrentCommit, getInferredRepoName, resolveRepoIdentityRoot } from '../../../storage/git.js';

const db = createDatabaseProvider();

export function createFinalizeStage(): PipelineContract<AnalyzeResult> {
  return {
    id: pid(STAGE_IDS.FINALIZE),
    label: 'Finalize Index',
    deps: [
      pid(STAGE_IDS.INGESTION),
      pid(STAGE_IDS.LADYBUGDB),
      pid(STAGE_IDS.SEARCH),
      pid(STAGE_IDS.EMBEDDINGS),
    ],
    resources: STAGE_RESOURCES.finalize.map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    run: async (ctx) => {
      ctx.progress('done', 98, 'Saving metadata...');

      const repoName = ctx.options.registryName ??
        getInferredRepoName(ctx.repoPath) ??
        path.basename(resolveRepoIdentityRoot(ctx.repoPath));

      const stats = await db.getStats(repoName);
      const embeddingCount = await countEmbeddings(
        (cypher: string) => db.executeQuery(repoName, cypher),
      );

      const embResult = ctx.results.get(pid(STAGE_IDS.EMBEDDINGS)) as
        | EmbeddingResult
        | undefined;
      const embeddingSkipped =
        !embResult || embResult.semanticMode === undefined;
      const semanticMode = embResult?.semanticMode;

      if (!embeddingSkipped && stats.nodes > 0 && embeddingCount === 0) {
        throw new Error(
          'Embedding generation completed without persisted embeddings. ' +
            'The index was not registered to avoid silently reporting embeddings: 0.',
        );
      }

      const ingestion = ctx.results.get(pid(STAGE_IDS.INGESTION)) as
        | { graph: unknown; repoPath: string }
        | undefined;

      const currentCommit = getCurrentCommit(ctx.repoPath);
      const existingMeta = await loadMeta(ctx.storagePath);

      const { meta, projectName } = await buildMeta(
        {
          repoPath: ctx.repoPath,
          storagePath: ctx.storagePath,
          currentCommit,
          options: ctx.options,
          pipelineResult: ingestion,
          stats,
          embeddingSkipped,
          embeddingCount,
          semanticMode,
          existingMetaStats: existingMeta?.stats ?? null,
        },
        embeddingCount,
      );

      await db.closeAll();
      ctx.progress('done', 100, 'Done');

      return {
        repoName: projectName,
        repoPath: ctx.repoPath,
        stats: meta.stats,
        pipelineResult: ingestion,
      };
    },
  };
}
