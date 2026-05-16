import path from 'path';
import type { PipelineContract } from '../types.js';
import { STAGE_IDS, STAGE_RESOURCES } from '../descriptors.js';
import { pid } from '../types.js';
import type { CachedEmbedding } from '../../embeddings/types.js';
import { createSearchFTSIndexes } from '../../search/fts-indexes.js';
import { restoreCachedEmbeddings } from '../../embeddings/cache-loader.js';
import { createDatabaseProvider } from '../../config/database-config.js';
import { getStageCache } from './embedding-stage.js';
import { getInferredRepoName, resolveRepoIdentityRoot } from '../../../storage/git.js';

const db = createDatabaseProvider();

export function createSearchStage(): PipelineContract<void> {
  return {
    id: pid(STAGE_IDS.SEARCH),
    label: 'Create Search Indexes',
    deps: [pid(STAGE_IDS.LADYBUGDB)],
    artifact: {
      version: 1,
      compute: () => `fts-${Date.now()}`,
    },
    resources: STAGE_RESOURCES.search.map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    run: async (ctx) => {
      ctx.progress('fts', 85, 'Creating search indexes...');
      await createSearchFTSIndexes();
      ctx.progress('fts', 90, 'Search indexes ready');

      const repoName = ctx.options.registryName ??
        getInferredRepoName(ctx.repoPath) ??
        path.basename(resolveRepoIdentityRoot(ctx.repoPath));

      const cache = getStageCache();
      if (cache.cachedEmbeddings.length > 0) {
        const restored = await restoreCachedEmbeddings(
          cache.cachedEmbeddings as CachedEmbedding[],
          (cypher: string, paramsList: Array<Record<string, any>>) =>
            db.executeBatch(repoName, cypher, paramsList),
          (msg: string) => ctx.log(msg),
          ctx.progress,
        );
        cache.cachedEmbeddings = restored.cachedEmbeddings;
        cache.cachedEmbeddingNodeIds = restored.cachedEmbeddingNodeIds;
      }
    },
  };
}
