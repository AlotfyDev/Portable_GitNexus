/**
 * Local Backend (Multi-Repo)
 *
 * Thin orchestration layer that delegates to helper modules.
 * Provides MCP tool implementations using local .gitnexus/ indexes.
 */

export { isWriteQuery } from '../../core/query/helpers/constants.js';
export { isTestFilePath, VALID_NODE_LABELS, VALID_RELATION_TYPES, IMPACT_RELATION_CONFIDENCE } from '../../core/query/helpers/constants.js';
export type { CodebaseContext } from '../../core/query/helpers/types.js';

import type { RepoHandle } from '../../core/query/helpers/types.js';
import type { QueryPipeline } from '../../core/query/QueryPipeline.js';
import { StateManager } from '../../core/query/helpers/state-manager.js';
import { dispatchTool } from '../../core/query/helpers/tool-dispatch.js';
import { formatCypherAsMarkdown } from '../../core/query/helpers/context-tools.js';
import { executeImpactByUid } from '../../core/query/helpers/impact.js';
import { queryClusters, queryProcesses, queryClusterDetail, queryProcessDetail } from '../../core/query/helpers/graph-queries.js';
import { readGroupContractsResource, readGroupStatusResource } from '../../core/query/helpers/group.js';
import { createDatabaseProvider } from '../../core/config/database-config.js';

export class LocalBackend {
  private ctx = new StateManager();
  private pipeline!: QueryPipeline;
  private dbProvider = createDatabaseProvider();

  async init(): Promise<boolean> {
    const { QueryPipelineImpl } = await import('../../core/query/QueryPipelineImpl.js');
    this.pipeline = new QueryPipelineImpl(this.dbProvider, this.ctx);
    return this.ctx.init();
  }

  async dispose(): Promise<void> {
    await this.pipeline?.dispose();
  }

  async resolveRepo(repoParam?: string): Promise<RepoHandle> {
    return this.ctx.resolveRepo(repoParam);
  }

  getContext(repoId?: string) {
    return this.ctx.getContext(repoId);
  }

  async listRepos() {
    return this.ctx.listRepos();
  }

  getGroupService() {
    return this.ctx.getGroupService({
      impact: (r, p) => this.impact(r, p),
      query: (r, p) => this.query(r, p),
      impactByUid: (id, uid, d, o) => this.impactByUid(id, uid, d as string, o),
      context: (r, p) => this.context(r, p),
    });
  }

  async callTool(method: string, params: any): Promise<any> {
    return dispatchTool(this.ctx, method, params);
  }

  async executeCypher(repoName: string, query: string): Promise<any> {
    const raw = await this.pipeline.cypher(repoName, query);
    return formatCypherAsMarkdown(raw);
  }

  async readGroupContractsResource(
    groupName: string,
    filter: { type?: string; repo?: string; unmatchedOnly?: boolean },
  ): Promise<string> {
    return readGroupContractsResource(this.ctx, groupName, filter);
  }

  async readGroupStatusResource(groupName: string): Promise<string> {
    return readGroupStatusResource(this.ctx, groupName);
  }

  async queryClusters(repoName?: string, limit = 100): Promise<{ clusters: any[] }> {
    const repo = await this.ctx.resolveRepo(repoName);
    await this.ctx.ensureInitialized(repo.id);
    return queryClusters(repo, limit);
  }

  async queryProcesses(repoName?: string, limit = 50): Promise<{ processes: any[] }> {
    const repo = await this.ctx.resolveRepo(repoName);
    await this.ctx.ensureInitialized(repo.id);
    return queryProcesses(repo, limit);
  }

  async queryClusterDetail(name: string, repoName?: string): Promise<any> {
    const repo = await this.ctx.resolveRepo(repoName);
    await this.ctx.ensureInitialized(repo.id);
    return queryClusterDetail(repo, name);
  }

  async queryProcessDetail(name: string, repoName?: string): Promise<any> {
    const repo = await this.ctx.resolveRepo(repoName);
    await this.ctx.ensureInitialized(repo.id);
    return queryProcessDetail(repo, name);
  }

  async impactByUid(
    repoId: string, uid: string, direction: string,
    opts: { maxDepth: number; relationTypes: string[]; minConfidence: number; includeTests: boolean; signal?: AbortSignal },
  ): Promise<any | null> {
    return executeImpactByUid(this.ctx, repoId, uid, direction, opts);
  }

  async disconnect(): Promise<void> {
    await this.ctx.disconnect();
  }

  // ── Private: used by GroupToolPort callbacks ──

  private async impact(repo: RepoHandle, params: any): Promise<any> {
    const { executeImpact } = await import('../../core/query/helpers/impact.js');
    await this.ctx.ensureInitialized(repo.id);
    return executeImpact(repo, params);
  }

  private async query(repo: RepoHandle, params: any): Promise<any> {
    const { executeQueryTool } = await import('../../core/query/helpers/search.js');
    await this.ctx.ensureInitialized(repo.id);
    return executeQueryTool(this.ctx, repo, params);
  }

  private async context(repo: RepoHandle, params: any): Promise<any> {
    const { executeContext } = await import('../../core/query/helpers/context-tools.js');
    await this.ctx.ensureInitialized(repo.id);
    return executeContext(repo, params);
  }
}
