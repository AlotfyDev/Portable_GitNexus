import { STAGE_IDS, STAGE_RESOURCES } from '../descriptors.js';
import { pid } from '../types.js';
import { createSearchFTSIndexes } from '../../search/fts-indexes.js';
import { restoreCachedEmbeddings } from '../../embeddings/cache-loader.js';
import { executeWithReusedStatement } from '../../lbug/lbug-adapter.js';
import { getStageCache } from './embedding-stage.js';
export function createSearchStage() {
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
            const cache = getStageCache();
            if (cache.cachedEmbeddings.length > 0) {
                const restored = await restoreCachedEmbeddings(cache.cachedEmbeddings, executeWithReusedStatement, (msg) => ctx.log(msg), ctx.progress);
                cache.cachedEmbeddings = restored.cachedEmbeddings;
                cache.cachedEmbeddingNodeIds = restored.cachedEmbeddingNodeIds;
            }
        },
    };
}
