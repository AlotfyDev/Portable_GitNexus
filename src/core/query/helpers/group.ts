import { resolveAtGroupMemberRepoPath } from '../../../core/group/resolve-at-member.js';
import { executeQueryTool } from './search.js';
import { executeContext } from './context-tools.js';
import { executeImpact, executeImpactByUid } from './impact.js';
import type { StateManager } from './state-manager.js';
import type { RepoHandle } from './types.js';

export async function dispatchGroupTool(
  ctx: StateManager, method: string, params: Record<string, unknown>,
): Promise<unknown> {
  const svc = getGroupService(ctx);
  switch (method) {
    case 'group_list': return svc.groupList(params);
    case 'group_sync': return svc.groupSync(params);
    default:
      throw new Error(`Unknown group tool: ${method}. Removed tools: use repo "@<groupName>" on impact, query, or context (optional "/<memberPath>"), or MCP resources.`);
  }
}

export async function callToolAtGroupRepo(
  ctx: StateManager, method: string, params: Record<string, unknown>,
): Promise<unknown> {
  if (params.service !== undefined && params.service !== null && String(params.service).trim() === '') {
    return { error: 'service must not be an empty string' };
  }

  const raw = String(params.repo).slice(1);
  const slash = raw.indexOf('/');
  const groupName = (slash === -1 ? raw : raw.slice(0, slash)).trim();
  const memberRest = slash === -1 ? undefined : raw.slice(slash + 1).trim() || undefined;

  const resolved = await resolveAtGroupMemberRepoPath(groupName, memberRest);
  if (resolved.ok === false) return { error: resolved.error };

  const svc = getGroupService(ctx);
  if (method === 'impact') {
    const impactArgs: Record<string, unknown> = { name: groupName, repo: resolved.repoPath, target: params.target, direction: params.direction };
    if (params.maxDepth !== undefined) impactArgs.maxDepth = params.maxDepth;
    if (params.crossDepth !== undefined) impactArgs.crossDepth = params.crossDepth;
    if (params.relationTypes !== undefined) impactArgs.relationTypes = params.relationTypes;
    if (params.includeTests !== undefined) impactArgs.includeTests = params.includeTests;
    if (params.minConfidence !== undefined) impactArgs.minConfidence = params.minConfidence;
    if (params.service !== undefined && params.service !== null) impactArgs.service = params.service;
    if (typeof params.subgroup === 'string') impactArgs.subgroup = params.subgroup;
    if (params.timeoutMs !== undefined) impactArgs.timeoutMs = params.timeoutMs;
    if (params.timeout !== undefined) impactArgs.timeout = params.timeout;
    return svc.groupImpact(impactArgs);
  }
  if (method === 'query') {
    const queryArgs: Record<string, unknown> = { name: groupName, query: params.query };
    if (typeof params.task_context === 'string') queryArgs.task_context = params.task_context;
    if (typeof params.goal === 'string') queryArgs.goal = params.goal;
    if (typeof params.limit === 'number') queryArgs.limit = params.limit;
    if (typeof params.max_symbols === 'number') queryArgs.max_symbols = params.max_symbols;
    if (params.include_content !== undefined) queryArgs.include_content = params.include_content;
    if (params.service !== undefined && params.service !== null) queryArgs.service = params.service;
    if (memberRest !== undefined) { queryArgs.subgroup = memberRest; queryArgs.subgroupExact = true; }
    return svc.groupQuery(queryArgs);
  }
  if (method === 'context') {
    const targetSym = typeof params.target === 'string' && params.target.trim() !== '' ? params.target.trim()
      : typeof params.name === 'string' && params.name.trim() !== '' ? params.name.trim() : undefined;
    const contextArgs: Record<string, unknown> = { name: groupName, target: targetSym };
    if (typeof params.uid === 'string') contextArgs.uid = params.uid;
    if (typeof params.file_path === 'string') contextArgs.file_path = params.file_path;
    if (params.include_content !== undefined) contextArgs.include_content = params.include_content;
    if (params.service !== undefined && params.service !== null) contextArgs.service = params.service;
    if (memberRest !== undefined) { contextArgs.subgroup = memberRest; contextArgs.subgroupExact = true; }
    return svc.groupContext(contextArgs);
  }
  throw new Error(`Internal: unsupported group-repo tool ${method}`);
}

export async function readGroupContractsResource(
  ctx: StateManager, groupName: string,
  filter: { type?: string; repo?: string; unmatchedOnly?: boolean },
): Promise<string> {
  try {
    const params: Record<string, unknown> = { name: groupName };
    if (filter.type !== undefined) params.type = filter.type;
    if (filter.repo !== undefined) params.repo = filter.repo;
    if (filter.unmatchedOnly === true) params.unmatchedOnly = true;
    const raw = await getGroupService(ctx).groupContracts(params);
    return formatGroupResourcePayload(raw);
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function readGroupStatusResource(ctx: StateManager, groupName: string): Promise<string> {
  try {
    const raw = await getGroupService(ctx).groupStatus({ name: groupName });
    return formatGroupResourcePayload(raw);
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function formatGroupResourcePayload(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'error' in raw) {
    const err = (raw as { error?: unknown }).error;
    if (typeof err === 'string' && err.length > 0) return `error: ${err}`;
  }
  return JSON.stringify(raw, null, 2);
}

function getGroupService(ctx: StateManager) {
  return ctx.getGroupService({
    impact: (r, p) => executeImpact(r as RepoHandle, p as any),
    query: (r, p) => executeQueryTool(ctx, r as RepoHandle, p as any),
    impactByUid: (id, uid, d, o) => executeImpactByUid(ctx, id, uid, d as string, o),
    context: (r, p) => executeContext(r as RepoHandle, p as any),
  });
}
