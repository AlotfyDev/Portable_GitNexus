import path from 'path';
import type { PipelineContract } from '../../pipeline-contract/types.js';
import { pid } from '../../pipeline-contract/types.js';
import { BOOST_STAGE_IDS, BOOST_STAGE_RESOURCES } from '../descriptors.js';
import type { NodeDescribeOutput, BoostConfig } from '../types.js';
import type { LLMClient } from '../cluster-enricher.js';
import { DatabaseProviderRegistry } from '../../storage/registry.js';
import { getInferredRepoName, resolveRepoIdentityRoot } from '../../../storage/git.js';

const db = DatabaseProviderRegistry.getProvider('ladybug');

const DESCRIBABLE_LABELS = ['Function', 'Class', 'Interface', 'Method', 'Struct', 'Enum'];

const BATCH_SIZE = 8;

function buildPrompt(nodes: Array<{ id: string; name: string; filePath: string; content: string; type: string }>): string {
  const entries = nodes
    .map(
      (n, i) =>
        `Node ${i + 1}:\nName: ${n.name}\nType: ${n.type}\nFile: ${n.filePath}\nContent:\`\`\`\n${(n.content || '').slice(0, 300)}\n\`\`\``,
    )
    .join('\n\n');

  return `You are a code documentation assistant. Generate a brief one-sentence description for each code element below.

${entries}

Respond with a JSON array only:
[{"id": "...", "description": "One sentence describing purpose", "oneLiner": "5-10 word summary", "tags": ["tag1", "tag2"], "confidence": 0.95}]`;
}

function parseBatchResponse(response: string, fallbackId: string): { description: string; tags: string[] } | null {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = parsed[0];
    return {
      description: String(first.description ?? ''),
      tags: Array.isArray(first.tags) ? first.tags.map(String) : [],
    };
  } catch {
    return null;
  }
}

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
          max_tokens: config?.maxTokens ?? 1024,
        }),
      });
      const data = (await response.json()) as { choices?: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    },
  };
}

export function createNodeDescribeStage(config?: BoostConfig): PipelineContract<NodeDescribeOutput> {
  return {
    id: pid(BOOST_STAGE_IDS.NODE_DESCRIBE),
    label: 'LLM Node Description',
    deps: [],
    artifact: {
      version: 1,
      compute: () => `node-desc-${Date.now()}`,
    },
    resources: BOOST_STAGE_RESOURCES['node-describe'].map((r) => ({
      ...r,
      check: () => ({ available: true }),
    })),
    run: async (ctx) => {
      const repoName = ctx.options.registryName ??
        getInferredRepoName(ctx.repoPath) ??
        path.basename(resolveRepoIdentityRoot(ctx.repoPath));
      ctx.progress('boost', 0, 'Querying nodes needing descriptions...');

      const allNodes: Array<{ id: string; name: string; filePath: string; content: string; type: string }> = [];
      for (const label of DESCRIBABLE_LABELS) {
        try {
          const rows = await db.executeQuery(repoName,
            `MATCH (n:${label}) WHERE n.description IS NULL OR n.description = '' RETURN n.id, n.name, n.filePath, n.content LIMIT 200`,
          );
          for (const r of rows as Array<Record<string, unknown>>) {
            allNodes.push({
              id: String(r.id ?? ''),
              name: String(r.name ?? ''),
              filePath: String(r.filePath ?? ''),
              content: String(r.content ?? ''),
              type: label,
            });
          }
        } catch {
          // Table may not exist for this label
        }
      }

      if (allNodes.length === 0) {
        ctx.log('[boost] No nodes need descriptions — skipping');
        return { describedCount: 0, tokensUsed: 0, durationMs: 0 };
      }

      ctx.log(`[boost] Generating descriptions for ${allNodes.length} nodes`);

      const llmClient = createLLMClient(config);
      let tokensUsed = 0;
      let describedCount = 0;
      const start = Date.now();

      for (let i = 0; i < allNodes.length; i += BATCH_SIZE) {
        const batch = allNodes.slice(i, i + BATCH_SIZE);
        const pct = Math.round((i / allNodes.length) * 80);
        ctx.progress('boost', pct, `Describing nodes ${i + 1}-${Math.min(i + BATCH_SIZE, allNodes.length)}/${allNodes.length}...`);

        try {
          const prompt = buildPrompt(batch);
          const response = await llmClient.generate(prompt);
          tokensUsed += Math.round(prompt.length / 4 + response.length / 4);

          const parsed = parseBatchResponse(response, batch[0].id);
          if (parsed) {
            for (const node of batch) {
              try {
                await db.executePrepared(repoName,
                  `MATCH (n:\`${node.type}\`) WHERE n.id = $id SET n.description = $desc`,
                  { id: node.id, desc: parsed.description },
                );
                describedCount++;
              } catch {
                // Skip nodes that fail to update
              }
            }
          }
        } catch (e) {
          ctx.log(`[boost] Batch ${i}-${i + BATCH_SIZE} LLM call failed: ${e}`);
        }
      }

      const durationMs = Date.now() - start;
      ctx.progress('boost', 100, 'Node descriptions complete');
      ctx.log(`[boost] Described ${describedCount}/${allNodes.length} nodes, ${tokensUsed} tokens`);

      return { describedCount, tokensUsed, durationMs };
    },
  };
}
