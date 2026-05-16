import path from 'path';
import type { PipelineContract } from '../../pipeline-contract/types.js';
import { pid } from '../../pipeline-contract/types.js';
import { BOOST_STAGE_IDS, BOOST_STAGE_RESOURCES } from '../descriptors.js';
import type { ClusterEnrichOutput, BoostConfig } from '../types.js';
import { DatabaseProviderRegistry } from '../../storage/registry.js';
import { enrichClusters } from '../cluster-enricher.js';
import type { CommunityNode, ClusterMemberInfo, LLMClient } from '../cluster-enricher.js';
import { getInferredRepoName, resolveRepoIdentityRoot } from '../../../storage/git.js';

const db = DatabaseProviderRegistry.getProvider('ladybug');

function createLLMClient(config?: BoostConfig): LLMClient {
  const provider = config?.llmProvider ?? 'openai';
  const model = config?.llmModel ?? 'gpt-4o-mini';
  const apiKey = config?.llmApiKey ?? process.env.OPENAI_API_KEY ?? '';

  if (provider === 'ollama') {
    const baseUrl = config?.llmBaseUrl ?? 'http://localhost:11434';
    return {
      generate: async (prompt: string) => {
        const response = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false }),
        });
        const data = (await response.json()) as { response?: string };
        return data.response ?? '';
      },
    };
  }

  const baseUrl = config?.llmBaseUrl ?? 'https://api.openai.com/v1';
  return {
    generate: async (prompt: string) => {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config?.maxTokens ?? 512,
        }),
      });
      const data = (await response.json()) as { choices?: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    },
  };
}

export function createClusterEnrichStage(config?: BoostConfig): PipelineContract<ClusterEnrichOutput> {
  return {
    id: pid(BOOST_STAGE_IDS.CLUSTER_ENRICH),
    label: 'LLM Cluster Enrichment',
    deps: [],
    artifact: {
      version: 1,
      compute: () => `cluster-enrich-${Date.now()}`,
    },
    resources: BOOST_STAGE_RESOURCES['cluster-enrich'].map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    run: async (ctx) => {
      const repoName = ctx.options.registryName ??
        getInferredRepoName(ctx.repoPath) ??
        path.basename(resolveRepoIdentityRoot(ctx.repoPath));
      ctx.progress('boost', 0, 'Reading communities from graph...');

      const communityRows = await db.executeQuery(repoName,
        `MATCH (c:Community) RETURN c.id, c.label, c.heuristicLabel, c.cohesion, c.symbolCount`,
      );

      if (!communityRows || communityRows.length === 0) {
        ctx.log('[boost] No communities found — skipping cluster enrichment');
        return { enrichCount: 0, tokensUsed: 0, durationMs: 0 };
      }

      const communities: CommunityNode[] = communityRows.map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ''),
        label: String(r.label ?? ''),
        heuristicLabel: String(r.heuristicLabel ?? ''),
        cohesion: Number(r.cohesion ?? 0),
        symbolCount: Number(r.symbolCount ?? 0),
      }));

      ctx.log(`[boost] Enriching ${communities.length} communities`);

      const memberMap = new Map<string, ClusterMemberInfo[]>();
      for (const community of communities) {
        const memberRows = await db.executeQuery(repoName,
          `MATCH (n)-[r:CodeRelation]->(c:Community) WHERE c.id = '${community.id.replace(/'/g, "''")}' RETURN n.name, n.filePath, labels(n)[0] AS type`,
        );
        if (memberRows && memberRows.length > 0) {
          memberMap.set(
            community.id,
            memberRows.map((r: Record<string, unknown>) => ({
              name: String(r.name ?? ''),
              filePath: String(r.filePath ?? ''),
              type: String(r.type ?? 'CodeElement'),
            })),
          );
        }
      }

      ctx.progress('boost', 30, 'Calling LLM for cluster enrichment...');

      const llmClient = createLLMClient(config);
      const start = Date.now();
      const result = await enrichClusters(
        communities,
        memberMap,
        llmClient,
        (current, total) => {
          const pct = 30 + Math.round((current / total) * 50);
          ctx.progress('boost', pct, `Enriching cluster ${current}/${total}...`);
        },
      );

      const durationMs = Date.now() - start;
      ctx.log(`[boost] Cluster enrichment done — ${result.enrichments.size} clusters, ${result.tokensUsed} tokens`);

      ctx.progress('boost', 85, 'Saving enrichment results...');
      let savedCount = 0;
      for (const [communityId, enrichment] of result.enrichments) {
        try {
          await db.executePrepared(repoName,
            `MATCH (c:Community) WHERE c.id = $id SET c.heuristicLabel = $name, c.keywords = $keywords, c.description = $description, c.enrichedBy = 'llm'`,
            { id: communityId, name: enrichment.name, keywords: enrichment.keywords, description: enrichment.description },
          );
          savedCount++;
        } catch (e) {
          ctx.log(`[boost] Failed to save enrichment for community ${communityId}: ${e}`);
        }
      }

      ctx.progress('boost', 100, 'Cluster enrichment complete');
      return { enrichCount: savedCount, tokensUsed: result.tokensUsed, durationMs };
    },
  };
}
