import { saveMeta, registerRepo, ensureGitNexusIgnored } from '../../storage/repo-manager.js';
import { getRemoteUrl, hasGitDir } from '../../storage/git.js';
import { generateAIContextFiles } from '../../cli/ai-context.js';
import { EMBEDDING_TABLE_NAME } from '../lbug/schema.js';
import type { AnalyzeOptions } from './types.js';

export interface FinalizeInput {
  repoPath: string;
  storagePath: string;
  currentCommit: string;
  options: AnalyzeOptions;
  pipelineResult: any;
  stats: { nodes: number; edges: number };
  embeddingSkipped: boolean;
  embeddingCount: number;
  semanticMode: 'vector-index' | 'exact-scan' | undefined;
  existingMetaStats?: { files?: number; communities?: number; processes?: number } | null;
}

export interface FinalizeOutput {
  projectName: string;
  meta: any;
  aggregatedClusterCount: number;
}

/**
 * Count persisted embeddings in the LadybugDB index.
 */
export async function countEmbeddings(
  executeQuery: (cypher: string) => Promise<any>,
): Promise<number> {
  try {
    const embResult = await executeQuery(
      `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN count(e) AS cnt`,
    );
    const row = embResult?.[0];
    return Number(row?.cnt ?? row?.[0] ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Compute aggregated cluster count from pipeline community results.
 */
export function computeClusterSummary(pipelineResult: any): number {
  if (!pipelineResult?.communityResult?.communities) return 0;
  const groups = new Map<string, number>();
  for (const c of pipelineResult.communityResult.communities) {
    const label = c.heuristicLabel || c.label || 'Unknown';
    groups.set(label, (groups.get(label) || 0) + c.symbolCount);
  }
  return Array.from(groups.values()).filter((count) => count >= 5).length;
}

/**
 * Build the meta object with stats and capabilities.
 */
export async function buildMeta(
  input: FinalizeInput,
  embeddingCount: number,
): Promise<{ meta: any; projectName: string; aggregatedClusterCount: number }> {
  const { getRuntimeCapabilities } = await import('../platform/capabilities.js');
  const runtimeCapabilities = getRuntimeCapabilities();

  const effectiveSemanticMode =
    input.semanticMode ??
    (runtimeCapabilities.semanticMode === 'vector-index' ? 'vector-index' : 'exact-scan');

  const priorStats = input.existingMetaStats ?? {};
  const meta = {
    repoPath: input.repoPath,
    lastCommit: input.currentCommit,
    indexedAt: new Date().toISOString(),
    remoteUrl: hasGitDir(input.repoPath) ? getRemoteUrl(input.repoPath) : undefined,
    stats: {
      files: input.pipelineResult?.totalFileCount ?? priorStats.files ?? 0,
      nodes: input.stats.nodes,
      edges: input.stats.edges,
      communities: input.pipelineResult?.communityResult?.stats.totalCommunities ?? priorStats.communities ?? 0,
      processes: input.pipelineResult?.processResult?.stats.totalProcesses ?? priorStats.processes ?? 0,
      embeddings: embeddingCount,
    },
    capabilities: {
      graph: { provider: 'ladybugdb', status: runtimeCapabilities.graph },
      fts: { provider: 'ladybugdb-fts', status: runtimeCapabilities.fts },
      vectorSearch: {
        provider: effectiveSemanticMode === 'vector-index' ? 'ladybugdb-vector' : 'exact-scan',
        status: embeddingCount > 0 ? effectiveSemanticMode : 'unavailable',
        exactScanLimit: runtimeCapabilities.exactScanLimit,
        reason: runtimeCapabilities.reason,
      },
    },
  };

  await saveMeta(input.storagePath, meta);

  const projectName = await registerRepo(input.repoPath, meta, {
    name: input.options.registryName,
    allowDuplicateName: input.options.allowDuplicateName,
  });

  await ensureGitNexusIgnored(input.repoPath);

  const aggregatedClusterCount = computeClusterSummary(input.pipelineResult);

  // ── Generate AI context files (best-effort) ───────────────────────
  try {
    const contextStats = input.pipelineResult
      ? {
          files: input.pipelineResult.totalFileCount,
          communities: input.pipelineResult.communityResult?.stats.totalCommunities,
          processes: input.pipelineResult.processResult?.stats.totalProcesses,
        }
      : {
          files: priorStats.files ?? 0,
          communities: priorStats.communities ?? 0,
          processes: priorStats.processes ?? 0,
        };

    await generateAIContextFiles(
      input.repoPath,
      input.storagePath,
      projectName,
      {
        files: contextStats.files,
        nodes: input.stats.nodes,
        edges: input.stats.edges,
        communities: contextStats.communities,
        clusters: aggregatedClusterCount,
        processes: contextStats.processes,
      },
      undefined,
      { skipAgentsMd: input.options.skipAgentsMd, noStats: input.options.noStats },
    );
  } catch {
    // Best-effort — don't fail the entire analysis for context file issues
  }

  return { meta, projectName, aggregatedClusterCount };
}
