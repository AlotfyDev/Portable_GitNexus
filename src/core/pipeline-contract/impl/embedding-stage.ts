import path from 'path';
import type { PipelineContract, CachePayload } from '../types.js';
import type { EmbeddingResult } from '../stages.js';
import { STAGE_IDS, STAGE_RESOURCES } from '../descriptors.js';
import { pid } from '../types.js';
import { STALE_HASH_SENTINEL } from '../../lbug/schema.js';
import {
  deriveEmbeddingMode,
  deriveEmbeddingCap,
  DEFAULT_EMBEDDING_NODE_LIMIT,
} from '../../embedding-mode.js';
import type { CachedEmbedding } from '../../embeddings/types.js';
import { logPerLabelNodeCounts } from '../../embeddings/diagnostic.js';
import { isHttpMode } from '../../embeddings/http-client.js';
import { runEmbeddingPipeline } from '../../embeddings/embedding-pipeline.js';
import { readServerMapping } from '../../embeddings/server-mapping.js';
import { loadEmbeddingCache } from '../../embeddings/cache-loader.js';
import { createDatabaseProvider } from '../../config/database-config.js';
import { loadMeta } from '../../../storage/repo-manager.js';
import {
  getInferredRepoName,
  resolveRepoIdentityRoot,
} from '../../../storage/git.js';

const db = createDatabaseProvider();

interface StageCacheData {
  cachedEmbeddings: CachedEmbedding[];
  cachedEmbeddingNodeIds: Set<string>;
}

let _stageCache: StageCacheData = {
  cachedEmbeddings: [],
  cachedEmbeddingNodeIds: new Set<string>(),
};

let _cacheAttempted = false;

export function getStageCache(): StageCacheData {
  return _stageCache;
}

export function createEmbeddingStage(): PipelineContract<EmbeddingResult> {
  return {
    id: pid(STAGE_IDS.EMBEDDINGS),
    label: 'Generate Embeddings',
    deps: [pid(STAGE_IDS.LADYBUGDB)],
    artifact: {
      version: 1,
      compute: () => `emb-${Date.now()}`,
    },
    resources: STAGE_RESOURCES.embeddings.map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    onBeforeInvalidation: async (ctx): Promise<CachePayload> => {
      if (_cacheAttempted) return { type: 'none' };
      _cacheAttempted = true;

      const meta = await loadMeta(ctx.storagePath);
      const existingCount =
        ((meta as unknown as Record<string, unknown>)?.stats as Record<string, unknown>)
          ?.embeddings ?? 0;
      const mode = deriveEmbeddingMode(ctx.options, existingCount as number);

      if (mode.shouldLoadCache && meta) {
        const repoName = ctx.options.registryName ??
          getInferredRepoName(ctx.repoPath) ??
          path.basename(resolveRepoIdentityRoot(ctx.repoPath));
        const result = await loadEmbeddingCache(
          ctx.lbugPath,
          true,
          true,
          (dbPath: string) => db.initialize(repoName, { connection: dbPath }),
          () => db.closeAll(),
          (msg: string) => ctx.log(msg),
          ctx.progress,
        );
        _stageCache.cachedEmbeddings = result.cachedEmbeddings;
        _stageCache.cachedEmbeddingNodeIds = result.cachedEmbeddingNodeIds;
      }

      return { type: 'none' };
    },
    run: async (ctx) => {
      const repoName = ctx.options.registryName ??
        getInferredRepoName(ctx.repoPath) ??
        path.basename(resolveRepoIdentityRoot(ctx.repoPath));
      const stats = await db.getStats(repoName);
      ctx.log(`[embedding] stats.nodes=${stats.nodes}`);

      const meta = await loadMeta(ctx.storagePath);
      const existingCount =
        ((meta as unknown as Record<string, unknown>)?.stats as Record<string, unknown>)
          ?.embeddings ?? 0;
      const mode = deriveEmbeddingMode(
        ctx.options,
        existingCount as number,
      );
      ctx.log(`[embedding] mode: generate=${mode.shouldGenerateEmbeddings}, preserve=${mode.preserveExistingEmbeddings}, cache=${mode.shouldLoadCache}`);

      let semanticMode: EmbeddingResult['semanticMode'];
      let embeddingsCount = 0;

      if (mode.shouldGenerateEmbeddings) {
        const { skipForCap, capDisabled, nodeLimit } = deriveEmbeddingCap(
          stats.nodes,
          ctx.options.embeddingsNodeLimit,
        );
        ctx.log(`[embedding] cap: skipForCap=${skipForCap}, nodeLimit=${nodeLimit}, nodes=${stats.nodes}`);

        if (!skipForCap) {
          if (capDisabled && stats.nodes > DEFAULT_EMBEDDING_NODE_LIMIT) {
            ctx.log(
              `Embedding node-count cap disabled — generating embeddings for ` +
                `${stats.nodes.toLocaleString()} nodes. Ensure sufficient memory; ` +
                `the default ${DEFAULT_EMBEDDING_NODE_LIMIT.toLocaleString()}-node ` +
                `cap exists to prevent OOM.`,
            );
          }

          const runQuery = (cypher: string) => db.executeQuery(repoName, cypher);
          await logPerLabelNodeCounts(
            runQuery,
            (msg: string) => ctx.log(msg),
          );

          const httpMode = isHttpMode();
          ctx.progress(
            'embeddings',
            90,
            httpMode
              ? 'Connecting to embedding endpoint...'
              : 'Loading embedding model...',
          );

          let existingEmbeddings: Map<string, string> | undefined;
          if (_stageCache.cachedEmbeddingNodeIds.size > 0) {
            existingEmbeddings = new Map<string, string>();
            for (const e of _stageCache.cachedEmbeddings) {
              existingEmbeddings.set(
                e.nodeId,
                e.contentHash ?? STALE_HASH_SENTINEL,
              );
            }
          }

          const projectName =
            ctx.options.registryName ??
            getInferredRepoName(ctx.repoPath) ??
            path.basename(resolveRepoIdentityRoot(ctx.repoPath));
          const serverName = await readServerMapping(projectName);

          const batchWrite = (cypher: string, paramsList: Array<Record<string, any>>) =>
            db.executeBatch(repoName, cypher, paramsList);
          const embeddingResult = await runEmbeddingPipeline(
            runQuery,
            batchWrite,
            (p) => {
              const scaled = 90 + Math.round((p.percent / 100) * 8);
              const label =
                p.phase === 'loading-model'
                  ? httpMode
                    ? 'Connecting to embedding endpoint...'
                    : 'Loading embedding model...'
                  : `Embedding ${p.nodesProcessed || 0}/${p.totalNodes || '?'}`;
              ctx.progress('embeddings', scaled, label);
            },
            {},
            _stageCache.cachedEmbeddingNodeIds.size > 0
              ? _stageCache.cachedEmbeddingNodeIds
              : undefined,
            { repoName: projectName, serverName },
            existingEmbeddings,
          );
          ctx.log(`[embedding] pipeline result: nodesProcessed=${embeddingResult.nodesProcessed}, chunksProcessed=${embeddingResult.chunksProcessed}, vectorIndexReady=${embeddingResult.vectorIndexReady}`);

          semanticMode =
            embeddingResult.semanticMode === 'exact-scan'
              ? 'exact-scan'
              : 'vector-index';
          embeddingsCount = embeddingResult.nodesProcessed;
        } else {
          ctx.log(
            `Embeddings skipped: ${stats.nodes.toLocaleString()} nodes exceeds ` +
              `the ${nodeLimit.toLocaleString()}-node safety cap. ` +
              `Override with \`--embeddings 0\` to disable the cap, or ` +
              `\`--embeddings <n>\` to set a custom cap.`,
          );
        }
      }

      return { semanticMode, embeddingsCount };
    },
  };
}
