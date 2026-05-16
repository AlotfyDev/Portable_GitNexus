import { dispatchGroupTool, callToolAtGroupRepo } from './group.js';
import { executeQueryTool } from './search.js';
import { executeContext, executeCypher, formatCypherAsMarkdown, executeOverview } from './context-tools.js';
import { executeImpact } from './impact.js';
import { executeDetectChanges } from './detect-changes.js';
import { executeRename } from './rename.js';
import { executeRouteMap, executeShapeCheck, executeToolMap, executeApiImpact } from './api-tools.js';
import { queryClusters, queryProcesses, queryClusterDetail, queryProcessDetail } from './graph-queries.js';
import type { StateManager } from './state-manager.js';
import type { RepoHandle } from './types.js';

export async function dispatchTool(
  ctx: StateManager, method: string, params: any,
): Promise<any> {
  if (method === 'list_repos') {
    return ctx.listRepos();
  }

  if (method.startsWith('group_')) {
    return dispatchGroupTool(ctx, method, params || {});
  }

  const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
  if (
    (method === 'impact' || method === 'query' || method === 'context') &&
    typeof p.repo === 'string' && p.repo.startsWith('@')
  ) {
    return callToolAtGroupRepo(ctx, method, p);
  }

  const repo = await ctx.resolveRepo((params as { repo?: string } | undefined)?.repo);

  switch (method) {
    case 'query':
      return executeQueryTool(ctx, repo, params);
    case 'cypher': {
      const raw = await executeCypher(repo, params);
      return formatCypherAsMarkdown(raw);
    }
    case 'context':
      return executeContext(repo, params);
    case 'impact':
      return executeImpact(repo, params);
    case 'detect_changes':
      return executeDetectChanges(repo, params);
    case 'rename':
      return executeRename(repo, params);
    case 'search':
      return executeQueryTool(ctx, repo, params);
    case 'explore':
      return executeContext(repo, { name: params?.name, ...params });
    case 'overview':
      return executeOverview(repo, params);
    case 'route_map':
      return executeRouteMap(repo, params);
    case 'shape_check':
      return executeShapeCheck(repo, params);
    case 'tool_map':
      return executeToolMap(repo, params);
    case 'api_impact':
      return executeApiImpact(repo, params);
    default:
      throw new Error(`Unknown tool: ${method}`);
  }
}
