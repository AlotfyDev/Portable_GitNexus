/**
 * Local Backend (Multi-Repo)
 *
 * Thin orchestration layer that delegates to helper modules.
 * Provides MCP tool implementations using local .gitnexus/ indexes.
 */

export { isWriteQuery } from '../../core/lbug/pool-adapter.js';
export { isTestFilePath, VALID_NODE_LABELS, VALID_RELATION_TYPES, IMPACT_RELATION_CONFIDENCE } from './helpers/constants.js';
export type { CodebaseContext } from './helpers/types.js';

import type { RepoHandle } from './helpers/types.js';
import { StateManager } from './helpers/state-manager.js';
import { dispatchTool } from './helpers/tool-dispatch.js';
import { executeCypher, formatCypherAsMarkdown } from './helpers/context-tools.js';
import { executeImpactByUid } from './helpers/impact.js';
import { queryClusters, queryProcesses, queryClusterDetail, queryProcessDetail } from './helpers/graph-queries.js';
import { readGroupContractsResource, readGroupStatusResource } from './helpers/group.js';

export class LocalBackend {
  private ctx = new StateManager();

  async init(): Promise<boolean> {
    return this.ctx.init();
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
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
    const repo = await this.ctx.resolveRepo(repoName);
    const raw = await executeCypher(repo, { query });
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
    const { executeImpact } = await import('./helpers/impact.js');
    await this.ctx.ensureInitialized(repo.id);
    return executeImpact(repo, params);
  }

  private async query(repo: RepoHandle, params: any): Promise<any> {
    const { executeQueryTool } = await import('./helpers/search.js');
    await this.ctx.ensureInitialized(repo.id);
    return executeQueryTool(this.ctx, repo, params);
  }

  private async context(repo: RepoHandle, params: any): Promise<any> {
    const { executeContext } = await import('./helpers/context-tools.js');
    await this.ctx.ensureInitialized(repo.id);
    return executeContext(repo, params);
  }
}
