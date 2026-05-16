import { createDatabaseProvider } from '../../config/database-config.js';
import { logQueryError } from './logging.js';
import type { RepoHandle } from './types.js';

const db = createDatabaseProvider();

async function fetchRoutesWithConsumers(
  repoId: string, routeFilter: string, params: Record<string, string>,
): Promise<Array<{
  id: string; name: string; filePath: string; responseKeys: string[] | null;
  errorKeys: string[] | null; middleware: string[] | null;
  consumers: Array<{ name: string; filePath: string; accessedKeys?: string[]; fetchCount?: number }>;
}>> {
  const rows = await db.executeParameterized(
    repoId,
    `MATCH (n:Route) WHERE n.id STARTS WITH 'Route:' ${routeFilter}
     OPTIONAL MATCH (consumer)-[r:CodeRelation]->(n) WHERE r.type = 'FETCHES'
     RETURN n.id AS routeId, n.name AS routeName, n.filePath AS handlerFile,
            n.responseKeys AS responseKeys, n.errorKeys AS errorKeys, n.middleware AS middleware,
            consumer.name AS consumerName, consumer.filePath AS consumerFile, r.reason AS fetchReason`,
    params,
  );

  const stripQuotes = (keys: string[] | null): string[] | null =>
    keys ? keys.map((k) => k.replace(/^['"]|['"]$/g, '')) : null;

  const routeMap = new Map<string, any>();
  for (const row of rows) {
    const id = row.routeId ?? row[0];
    const name = row.routeName ?? row[1];
    const filePath = row.handlerFile ?? row[2];
    const responseKeys = stripQuotes(row.responseKeys ?? row[3] ?? null);
    const errorKeys = stripQuotes(row.errorKeys ?? row[4] ?? null);
    const middleware = stripQuotes(row.middleware ?? row[5] ?? null);
    const consumerName = row.consumerName ?? row[6];
    const consumerFile = row.consumerFile ?? row[7];
    const fetchReason: string | null = row.fetchReason ?? row[8] ?? null;

    if (!routeMap.has(id)) {
      routeMap.set(id, { id, name, filePath, responseKeys, errorKeys, middleware, consumers: [] });
    }
    if (consumerName && consumerFile) {
      let accessedKeys: string[] | undefined;
      let fetchCount: number | undefined;
      if (fetchReason) {
        const keysMatch = fetchReason.match(/\|keys:([^|]+)/);
        if (keysMatch) accessedKeys = keysMatch[1].split(',').filter((k) => k.length > 0);
        const fetchesMatch = fetchReason.match(/\|fetches:(\d+)/);
        if (fetchesMatch) fetchCount = parseInt(fetchesMatch[1], 10);
      }
      routeMap.get(id)!.consumers.push({
        name: consumerName, filePath: consumerFile,
        ...(accessedKeys ? { accessedKeys } : {}),
        ...(fetchCount && fetchCount > 1 ? { fetchCount } : {}),
      });
    }
  }

  return [...routeMap.values()];
}

async function fetchLinkedFlowsBatch(
  repoId: string, nodeIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (nodeIds.length === 0) return result;
  try {
    const rows = await db.executeParameterized(
      repoId,
      `MATCH (source)-[r:CodeRelation]->(proc:Process)
       WHERE r.type = 'ENTRY_POINT_OF' AND list_contains($nodeIds, source.id)
       RETURN source.id AS sourceId, proc.label AS name`,
      { nodeIds },
    );
    for (const row of rows) {
      const sourceId = row.sourceId ?? row[0];
      const name = row.name ?? row[1];
      if (!name) continue;
      let list = result.get(sourceId);
      if (!list) { list = []; result.set(sourceId, list); }
      list.push(name);
    }
  } catch { /* no ENTRY_POINT_OF edges yet */ }
  return result;
}

export async function executeRouteMap(repo: RepoHandle, params: { route?: string }): Promise<any> {
  const routeFilter = params.route ? `AND n.name CONTAINS $route` : '';
  const queryParams = params.route ? { route: params.route } : {};
  const routes = await fetchRoutesWithConsumers(repo.id, routeFilter, queryParams);

  if (routes.length === 0) {
    return { routes: [], total: 0, message: params.route ? `No routes matching "${params.route}"` : 'No routes found in this project.' };
  }

  const flowMap = await fetchLinkedFlowsBatch(repo.id, routes.map((r) => r.id));

  return {
    routes: routes.map((r) => ({ route: r.name, handler: r.filePath, middleware: r.middleware || [], consumers: r.consumers, flows: flowMap.get(r.id) || [] })),
    total: routes.length,
  };
}

export async function executeShapeCheck(repo: RepoHandle, params: { route?: string }): Promise<any> {
  const routeFilter = params.route ? `AND n.name CONTAINS $route` : '';
  const queryParams = params.route ? { route: params.route } : {};
  const allRoutes = await fetchRoutesWithConsumers(repo.id, routeFilter, queryParams);

  const results = allRoutes
    .filter((r) => ((r.responseKeys && r.responseKeys.length > 0) || (r.errorKeys && r.errorKeys.length > 0)) && r.consumers.length > 0)
    .map((r) => {
      const responseKeys = r.responseKeys ?? [];
      const errorKeys = r.errorKeys ?? [];
      const allKnownKeys = new Set([...responseKeys, ...errorKeys]);
      const responseKeySet = new Set(responseKeys);

      const consumers = r.consumers.map((c) => {
        if (!c.accessedKeys || c.accessedKeys.length === 0) return { name: c.name, filePath: c.filePath };
        const mismatched = c.accessedKeys.filter((k) => !allKnownKeys.has(k));
        const errorPathKeys = c.accessedKeys.filter((k) => allKnownKeys.has(k) && !responseKeySet.has(k));
        const isMultiFetch = (c.fetchCount ?? 1) > 1;
        return {
          name: c.name, filePath: c.filePath, accessedKeys: c.accessedKeys,
          ...(mismatched.length > 0 ? { mismatched, mismatchConfidence: isMultiFetch ? ('low' as const) : ('high' as const) } : {}),
          ...(errorPathKeys.length > 0 ? { errorPathKeys } : {}),
          ...(isMultiFetch ? { attributionNote: `This file fetches ${c.fetchCount} routes — accessed keys may belong to a different route.` } : {}),
        };
      });

      const hasMismatches = consumers.some((c) => 'mismatched' in c && (c as any).mismatched.length > 0);
      return { route: r.name, handler: r.filePath, ...(responseKeys.length > 0 ? { responseKeys } : {}), ...(errorKeys.length > 0 ? { errorKeys } : {}), consumers, ...(hasMismatches ? { status: 'MISMATCH' as const } : {}) };
    });

  const mismatchCount = results.filter((r) => r.status === 'MISMATCH').length;
  return {
    routes: results, total: results.length, routesWithShapes: results.length,
    ...(mismatchCount > 0 ? { mismatches: mismatchCount } : {}),
    message: results.length === 0 ? 'No routes with both response shapes and consumers found.'
      : mismatchCount > 0 ? `Found ${results.length} route(s) with response shape data. ${mismatchCount} route(s) have consumer/shape mismatches.`
      : `Found ${results.length} route(s) with response shape data and consumers.`,
  };
}

export async function executeToolMap(repo: RepoHandle, params: { tool?: string }): Promise<any> {
  const toolFilter = params.tool ? `AND n.name CONTAINS $tool` : '';
  const queryParams = params.tool ? { tool: params.tool } : {};

  const rows = await db.executeParameterized(
    repo.id,
    `MATCH (n:Tool) WHERE n.id STARTS WITH 'Tool:' ${toolFilter}
     RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.description AS description`,
    queryParams,
  );

  if (rows.length === 0) {
    return { tools: [], total: 0, message: params.tool ? `No tools matching "${params.tool}"` : 'No tool definitions found.' };
  }

  const toolIds = rows.map((r: any) => r.id ?? r[0]);
  const flowMap = await fetchLinkedFlowsBatch(repo.id, toolIds);

  return {
    tools: rows.map((r: any) => {
      const id = r.id ?? r[0];
      return { name: r.name ?? r[1], filePath: r.filePath ?? r[2], description: (r.description ?? r[3] ?? '').slice(0, 200), flows: flowMap.get(id) || [] };
    }),
    total: rows.length,
  };
}

export async function executeApiImpact(repo: RepoHandle, params: { route?: string; file?: string }): Promise<any> {
  if (!params.route && !params.file) return { error: 'Either "route" or "file" parameter is required.' };

  let routeFilter = '';
  const queryParams: Record<string, string> = {};

  if (params.route) { routeFilter = `AND n.name CONTAINS $route`; queryParams.route = params.route; }
  else if (params.file) { routeFilter = `AND n.filePath CONTAINS $file`; queryParams.file = params.file; }

  const routes = await fetchRoutesWithConsumers(repo.id, routeFilter, queryParams);

  if (routes.length === 0) return { error: `No routes found matching "${params.route || params.file}".` };

  const flowMap = await fetchLinkedFlowsBatch(repo.id, routes.map((r) => r.id));

  const routeCountByHandler = new Map<string, number>();
  for (const r of routes) {
    if (r.filePath) routeCountByHandler.set(r.filePath, (routeCountByHandler.get(r.filePath) ?? 0) + 1);
  }

  const results = routes.map((r) => {
    const responseKeys = r.responseKeys ?? [];
    const errorKeys = r.errorKeys ?? [];
    const allKnownKeys = new Set([...responseKeys, ...errorKeys]);

    const consumers = r.consumers.map((c) => ({
      name: c.name, file: c.filePath, accesses: c.accessedKeys ?? [],
      ...(c.fetchCount && c.fetchCount > 1 ? { attributionNote: `This file fetches ${c.fetchCount} routes — accessed keys may belong to a different route.` } : {}),
    }));

    const mismatches: Array<{ consumer: string; field: string; reason: string; confidence: 'high' | 'low' }> = [];
    if (allKnownKeys.size > 0) {
      for (const c of r.consumers) {
        if (!c.accessedKeys) continue;
        const isMultiFetch = (c.fetchCount ?? 1) > 1;
        for (const key of c.accessedKeys) {
          if (!allKnownKeys.has(key)) {
            mismatches.push({ consumer: c.filePath, field: key, reason: 'accessed but not in response shape', confidence: isMultiFetch ? 'low' : 'high' });
          }
        }
      }
    }

    const flows = flowMap.get(r.id) || [];
    const consumerCount = r.consumers.length;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (consumerCount >= 10) riskLevel = 'HIGH';
    else if (consumerCount >= 4) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';
    if (mismatches.length > 0) {
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      else if (riskLevel === 'MEDIUM') riskLevel = 'HIGH';
    }

    const warning = consumerCount > 0 ? `Changing response shape will affect ${consumerCount} component${consumerCount === 1 ? '' : 's'}` : undefined;
    const middlewareArr = r.middleware || [];
    const handlerRouteCount = r.filePath ? (routeCountByHandler.get(r.filePath) ?? 1) : 1;
    const middlewarePartial = middlewareArr.length > 0 && handlerRouteCount > 1;

    return {
      route: r.name, handler: r.filePath,
      responseShape: { success: responseKeys, error: errorKeys },
      middleware: middlewareArr,
      ...(middlewarePartial ? { middlewareDetection: 'partial' as const, middlewareNote: 'Middleware captured from first HTTP method export only — other methods in this handler may use different middleware chains.' } : {}),
      consumers,
      ...(mismatches.length > 0 ? { mismatches } : {}),
      executionFlows: flows,
      impactSummary: { directConsumers: consumerCount, affectedFlows: flows.length, riskLevel, ...(warning ? { warning } : {}) },
    };
  });

  if (results.length === 1) return results[0];
  return { routes: results, total: results.length };
}
