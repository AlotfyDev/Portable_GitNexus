import { executeParameterized } from '../../../core/lbug/pool-adapter.js';
import type { RepoHandle } from './types.js';

export async function enrichCandidateLabels(
  repo: RepoHandle, candidates: Array<{ id: string; type: string }>,
): Promise<void> {
  const ids = candidates.filter((c) => c.type === '' && c.id).map((c) => c.id);
  if (ids.length === 0) return;
  try {
    const rows = await executeParameterized(
      repo.id,
      `MATCH (n:\`Class\`) WHERE n.id IN $ids RETURN n.id AS id, 'Class' AS label
       UNION ALL MATCH (n:\`Interface\`) WHERE n.id IN $ids RETURN n.id AS id, 'Interface' AS label
       UNION ALL MATCH (n:\`Function\`) WHERE n.id IN $ids RETURN n.id AS id, 'Function' AS label
       UNION ALL MATCH (n:\`Method\`) WHERE n.id IN $ids RETURN n.id AS id, 'Method' AS label
       UNION ALL MATCH (n:\`Constructor\`) WHERE n.id IN $ids RETURN n.id AS id, 'Constructor' AS label`,
      { ids },
    );
    const labelById = new Map<string, string>();
    for (const r of rows as any[]) {
      const id = (r.id ?? r[0]) as string;
      const label = (r.label ?? r[1]) as string;
      if (id && label && !labelById.has(id)) labelById.set(id, label);
    }
    for (const c of candidates) {
      if (c.type === '' && labelById.has(c.id)) c.type = labelById.get(c.id) as string;
    }
  } catch { /* best-effort */ }
}

export function scoreCandidate(
  c: { kind: string; filePath: string },
  hints: { file_path?: string; kind?: string },
): number {
  let s = 0.5;
  if (hints.file_path && c.filePath && typeof c.filePath === 'string') {
    if (c.filePath.toLowerCase().includes(hints.file_path.toLowerCase())) s += 0.4;
  }
  if (hints.kind && c.kind === hints.kind) s += 0.2;
  if (!hints.kind) {
    const priority: Record<string, number> = {
      Class: 5, Interface: 4, Function: 3, Method: 2, Constructor: 1,
    };
    s += (priority[c.kind] ?? 0) * 0.02;
  }
  return Math.min(1.0, s);
}

export async function resolveSymbolCandidates(
  repo: RepoHandle,
  query: { uid?: string; name?: string; include_content?: boolean },
  hints: { file_path?: string; kind?: string },
): Promise<
  | { kind: 'ok'; symbol: { id: string; name: string; type: string; filePath: string; startLine: number; endLine: number; content?: string }; resolvedLabel: string }
  | { kind: 'ambiguous'; candidates: Array<{ id: string; name: string; type: string; filePath: string; startLine: number; endLine: number; score: number }> }
  | { kind: 'not_found' }
> {
  const { uid, name, include_content } = query;
  const selectClause = `n.id AS id, n.name AS name, labels(n)[0] AS type, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine${include_content ? ', n.content AS content' : ''}`;

  if (uid) {
    const rows = await executeParameterized(
      repo.id, `MATCH (n {id: $uid}) RETURN ${selectClause} LIMIT 1`, { uid },
    );
    if (rows.length === 0) return { kind: 'not_found' };
    const r = rows[0] as any;
    const symbol = {
      id: (r.id ?? r[0]) as string, name: (r.name ?? r[1]) as string,
      type: (r.type ?? r[2] ?? '') as string, filePath: (r.filePath ?? r[3]) as string,
      startLine: (r.startLine ?? r[4]) as number, endLine: (r.endLine ?? r[5]) as number,
      ...(include_content ? { content: (r.content ?? r[6]) as string | undefined } : {}),
    };
    await enrichCandidateLabels(repo, [symbol]);
    return { kind: 'ok', symbol, resolvedLabel: symbol.type };
  }

  if (!name) return { kind: 'not_found' };

  const isQualified = name.includes('/') || name.includes(':');
  let whereClause: string;
  const queryParams: Record<string, any> = { symName: name };
  if (hints.file_path) {
    whereClause = `WHERE n.name = $symName AND n.filePath CONTAINS $filePath`;
    queryParams.filePath = hints.file_path;
  } else if (isQualified) {
    whereClause = `WHERE n.id = $symName OR n.name = $symName`;
  } else {
    whereClause = `WHERE n.name = $symName`;
  }

  const rows = await executeParameterized(
    repo.id, `MATCH (n) ${whereClause} RETURN ${selectClause} LIMIT 20`, queryParams,
  );
  if (rows.length === 0) return { kind: 'not_found' };

  const normalized = rows.map((r: any) => ({
    id: (r.id ?? r[0]) as string, name: (r.name ?? r[1]) as string,
    type: (r.type ?? r[2] ?? '') as string, filePath: (r.filePath ?? r[3]) as string,
    startLine: (r.startLine ?? r[4]) as number, endLine: (r.endLine ?? r[5]) as number,
    ...(include_content ? { content: (r.content ?? r[6]) as string | undefined } : {}),
  }));

  await enrichCandidateLabels(repo, normalized);

  if (!hints.kind && normalized.length > 1) {
    const ambiguousType = normalized.some((s) => s.type === '' || s.type === 'Constructor');
    if (ambiguousType) {
      const candidateIds = normalized.map((s) => s.id).filter(Boolean);
      for (const label of ['Class', 'Interface']) {
        const labelRows = await executeParameterized(
          repo.id,
          `MATCH (n:\`${label}\`) WHERE n.id IN $candidateIds RETURN n.id AS id LIMIT 1`,
          { candidateIds },
        ).catch(() => []);
        if (labelRows.length > 0) {
          const preferredId = (labelRows[0] as any).id ?? (labelRows[0] as any)[0];
          const preferred = normalized.find((s) => s.id === preferredId);
          if (preferred) return { kind: 'ok', symbol: preferred, resolvedLabel: label };
        }
      }
    }
  }

  if (normalized.length === 1) {
    return { kind: 'ok', symbol: normalized[0], resolvedLabel: '' };
  }

  const scored = normalized.map((s) => ({
    ...s, score: scoreCandidate({ kind: s.type, filePath: s.filePath || '' }, hints),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fpA = (a.filePath || '').length;
    const fpB = (b.filePath || '').length;
    if (fpA !== fpB) return fpA - fpB;
    return String(a.id).localeCompare(String(b.id));
  });

  if (scored.length >= 2 && scored[0].score >= 0.95 && scored[0].score - scored[1].score > 0.09) {
    return { kind: 'ok', symbol: scored[0], resolvedLabel: scored[0].type };
  }

  return { kind: 'ambiguous', candidates: scored };
}

export function aggregateClusters(clusters: any[]): any[] {
  const groups = new Map<
    string, { ids: string[]; totalSymbols: number; weightedCohesion: number; largest: any }
  >();

  for (const c of clusters) {
    const label = c.heuristicLabel || c.label || 'Unknown';
    const symbols = c.symbolCount || 0;
    const cohesion = c.cohesion || 0;
    const existing = groups.get(label);

    if (!existing) {
      groups.set(label, {
        ids: [c.id], totalSymbols: symbols, weightedCohesion: cohesion * symbols, largest: c,
      });
    } else {
      existing.ids.push(c.id);
      existing.totalSymbols += symbols;
      existing.weightedCohesion += cohesion * symbols;
      if (symbols > (existing.largest.symbolCount || 0)) existing.largest = c;
    }
  }

  return Array.from(groups.entries())
    .map(([label, g]) => ({
      id: g.largest.id, label, heuristicLabel: label,
      symbolCount: g.totalSymbols,
      cohesion: g.totalSymbols > 0 ? g.weightedCohesion / g.totalSymbols : 0,
      subCommunities: g.ids.length,
    }))
    .filter((c) => c.symbolCount >= 5)
    .sort((a, b) => b.symbolCount - a.symbolCount);
}
