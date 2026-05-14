/**
 * Local Backend (Multi-Repo)
 *
 * Thin orchestration layer that delegates to helper modules.
 * Provides MCP tool implementations using local .gitnexus/ indexes.
 */
export { isWriteQuery } from '../../core/lbug/pool-adapter.js';
export { isTestFilePath, VALID_NODE_LABELS, VALID_RELATION_TYPES, IMPACT_RELATION_CONFIDENCE } from './helpers/constants.js';
import { StateManager } from './helpers/state-manager.js';
import { dispatchTool } from './helpers/tool-dispatch.js';
import { executeCypher, formatCypherAsMarkdown } from './helpers/context-tools.js';
import { executeImpactByUid } from './helpers/impact.js';
import { queryClusters, queryProcesses, queryClusterDetail, queryProcessDetail } from './helpers/graph-queries.js';
import { readGroupContractsResource, readGroupStatusResource } from './helpers/group.js';
export class LocalBackend {
    ctx = new StateManager();
    async init() {
        return this.ctx.init();
    }
    async dispose() {
        await this.ctx.dispose();
    }
    async resolveRepo(repoParam) {
        return this.ctx.resolveRepo(repoParam);
    }
    getContext(repoId) {
        return this.ctx.getContext(repoId);
    }
    async listRepos() {
        return this.ctx.listRepos();
    }
    getGroupService() {
        return this.ctx.getGroupService({
            impact: (r, p) => this.impact(r, p),
            query: (r, p) => this.query(r, p),
            impactByUid: (id, uid, d, o) => this.impactByUid(id, uid, d, o),
            context: (r, p) => this.context(r, p),
        });
    }
    async callTool(method, params) {
        return dispatchTool(this.ctx, method, params);
    }
    async executeCypher(repoName, query) {
        const repo = await this.ctx.resolveRepo(repoName);
        const raw = await executeCypher(repo, { query });
        return formatCypherAsMarkdown(raw);
    }
    async readGroupContractsResource(groupName, filter) {
        return readGroupContractsResource(this.ctx, groupName, filter);
    }
    async readGroupStatusResource(groupName) {
        return readGroupStatusResource(this.ctx, groupName);
    }
    async queryClusters(repoName, limit = 100) {
        const repo = await this.ctx.resolveRepo(repoName);
        await this.ctx.ensureInitialized(repo.id);
        return queryClusters(repo, limit);
    }
    async queryProcesses(repoName, limit = 50) {
        const repo = await this.ctx.resolveRepo(repoName);
        await this.ctx.ensureInitialized(repo.id);
        return queryProcesses(repo, limit);
    }
    async queryClusterDetail(name, repoName) {
        const repo = await this.ctx.resolveRepo(repoName);
        await this.ctx.ensureInitialized(repo.id);
        return queryClusterDetail(repo, name);
    }
    async queryProcessDetail(name, repoName) {
        const repo = await this.ctx.resolveRepo(repoName);
        await this.ctx.ensureInitialized(repo.id);
        return queryProcessDetail(repo, name);
    }
    async impactByUid(repoId, uid, direction, opts) {
        return executeImpactByUid(this.ctx, repoId, uid, direction, opts);
    }
    async disconnect() {
        await this.ctx.disconnect();
    }
    // ── Private: used by GroupToolPort callbacks ──
    async impact(repo, params) {
        const { executeImpact } = await import('./helpers/impact.js');
        await this.ctx.ensureInitialized(repo.id);
        return executeImpact(repo, params);
    }
    async query(repo, params) {
        const { executeQueryTool } = await import('./helpers/search.js');
        await this.ctx.ensureInitialized(repo.id);
        return executeQueryTool(this.ctx, repo, params);
    }
    async context(repo, params) {
        const { executeContext } = await import('./helpers/context-tools.js');
        await this.ctx.ensureInitialized(repo.id);
        return executeContext(repo, params);
    }
}
