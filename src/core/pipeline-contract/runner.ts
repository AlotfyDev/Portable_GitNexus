import type { PipelineContract, PipelineId, PipelineRunner, PipelineRunOptions, PipelineRunReport, ArtifactRecord, PipelineContext, CachePayload } from './types.js';
import { loadMeta, saveMeta } from '../../storage/repo-manager.js';

function resolvePipelines(
  contracts: Map<PipelineId, PipelineContract>,
  requested: PipelineId[],
): { groups: PipelineId[][]; allIds: Set<PipelineId> } {
  const visited = new Set<PipelineId>();
  const stack = new Set<PipelineId>();
  const depths = new Map<PipelineId, number>();
  const allIds = new Set<PipelineId>();

  function dfs(id: PipelineId): void {
    if (stack.has(id)) {
      throw new Error(`Circular dependency detected for pipeline: ${id}`);
    }
    if (visited.has(id)) return;
    visited.add(id);
    allIds.add(id);

    const contract = contracts.get(id);
    if (!contract) {
      throw new Error(`Unknown pipeline: ${id}`);
    }

    stack.add(id);
    let maxDepth = -1;
    for (const dep of contract.deps) {
      dfs(dep);
      const depDepth = depths.get(dep) ?? -1;
      if (depDepth > maxDepth) maxDepth = depDepth;
    }
    stack.delete(id);
    depths.set(id, maxDepth + 1);
  }

  for (const id of requested) {
    dfs(id);
  }

  const maxDepth = Math.max(...depths.values(), -1);
  const groups: PipelineId[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    const group: PipelineId[] = [];
    for (const [id, depth] of depths) {
      if (depth === d) group.push(id);
    }
    if (group.length > 0) groups.push(group);
  }

  return { groups, allIds };
}

async function loadArtifactFingerprint(
  storagePath: string, pipelineId: PipelineId,
): Promise<ArtifactRecord | null> {
  const meta = await loadMeta(storagePath);
  if (!meta) return null;
  const m = meta as unknown as { artifacts?: Record<string, ArtifactRecord> };
  return m.artifacts?.[pipelineId] ?? null;
}

async function saveArtifactFingerprint(
  storagePath: string, pipelineId: PipelineId, record: ArtifactRecord,
): Promise<void> {
  const loaded = await loadMeta(storagePath);
  const meta = (loaded ?? {}) as unknown as { artifacts?: Record<string, ArtifactRecord> };
  const artifacts = meta.artifacts ?? {};
  artifacts[pipelineId] = record;
  meta.artifacts = artifacts;
  await saveMeta(storagePath, meta as unknown as Parameters<typeof saveMeta>[1]);
}

async function notifyDependents(
  contracts: Map<PipelineId, PipelineContract>,
  upstreamId: PipelineId,
  ctx: PipelineContext,
): Promise<Map<PipelineId, CachePayload>> {
  const payloads = new Map<PipelineId, CachePayload>();
  for (const [id, contract] of contracts) {
    if (contract.deps.includes(upstreamId) && contract.onBeforeInvalidation) {
      const payload = await contract.onBeforeInvalidation(ctx);
      payloads.set(id, payload);
    }
  }
  return payloads;
}

export function createPipelineRunner(
  contracts: Map<PipelineId, PipelineContract>,
): PipelineRunner {
  return {
    resolveOrder(ids?: PipelineId[]): PipelineId[][] {
      const requested = ids ?? [...contracts.keys()];
      const { groups } = resolvePipelines(contracts, requested);
      return groups;
    },

    async runPipelines(
      ctx: PipelineContext,
      options: PipelineRunOptions,
    ): Promise<PipelineRunReport> {
      const ids = options.only ?? [...contracts.keys()];
      const { groups } = resolvePipelines(contracts, ids);

      const results = new Map<PipelineId, { output: unknown; artifact: ArtifactRecord | undefined; durationMs: number }>();
      const skipped: PipelineId[] = [];
      const failed: PipelineId[] = [];
      const freshList: PipelineId[] = [];
      let aborted = false;

      for (const group of groups) {
        for (const id of group) {
          if (aborted) {
            skipped.push(id);
            continue;
          }

          const contract = contracts.get(id)!;

          let canRun = true;
          for (const res of contract.resources) {
            const status = res.check();
            if (!status.available && res.criticality === 'fatal') {
              canRun = false;
              failed.push(id);
              if (options.failFast) aborted = true;
              break;
            }
          }
          if (!canRun) continue;

          if (!options.force && contract.artifact) {
            const stored = await loadArtifactFingerprint(ctx.storagePath, id);
            if (stored) {
              const current = contract.artifact.compute(ctx);
              if (stored.fingerprint === current) {
                freshList.push(id);
                continue;
              }
            }
          }

          // Explicit skip — don't run but don't fail
          if (options.skip?.includes(id)) {
            skipped.push(id);
            continue;
          }

          if (contract.onBeforeInvalidation) {
            await contract.onBeforeInvalidation(ctx);
          }
          await notifyDependents(contracts, id, ctx);

          const start = Date.now();
          try {
            const output = await contract.run(ctx);
            const durationMs = Date.now() - start;

            let artifact: ArtifactRecord | undefined;
            if (contract.artifact) {
              artifact = {
                version: contract.artifact.version,
                fingerprint: contract.artifact.compute(ctx),
                producedAt: new Date().toISOString(),
                clean: true,
              };
              await saveArtifactFingerprint(ctx.storagePath, id, artifact);
            }

            results.set(id, { output, artifact, durationMs });
            ctx.results.set(id, output); // ← make available to downstream stages
          } catch (err) {
            const durationMs = Date.now() - start;
            if (typeof ctx.log === 'function') {
              ctx.log(`[${id}] Stage failed: ${(err as Error)?.message ?? String(err)}`);
            }
            failed.push(id);
            if (options.failFast) {
              aborted = true;
            }
          }
        }
      }

      return {
        results,
        skipped,
        failed,
        fresh: freshList,
      };
    },
  };
}
