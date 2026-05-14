import { executeQuery, executeParameterized, isWriteQuery, isLbugReady, } from '../../../core/lbug/pool-adapter.js';
import { isWalCorruptionError, WAL_RECOVERY_SUGGESTION } from '../../../core/lbug/lbug-config.js';
import { logQueryError } from './logging.js';
import { aggregateClusters, resolveSymbolCandidates } from './symbol-resolution.js';
function categorize(rows) {
    const cats = {};
    for (const row of rows) {
        const relType = (row.relType || row[0] || '').toLowerCase();
        const entry = { uid: row.uid || row[1], name: row.name || row[2], filePath: row.filePath || row[3], kind: row.kind || row[4] };
        if (!cats[relType])
            cats[relType] = [];
        cats[relType].push(entry);
    }
    return cats;
}
export async function _contextImpl(repo, params) {
    const { name, uid, file_path, kind, include_content } = params;
    if (!name && !uid)
        return { error: 'Either "name" or "uid" parameter is required.' };
    const outcome = await resolveSymbolCandidates(repo, { uid, name, include_content }, { file_path, kind });
    if (outcome.kind === 'not_found')
        return { error: `Symbol '${name || uid}' not found` };
    if (outcome.kind === 'ambiguous') {
        return {
            status: 'ambiguous',
            message: `Found ${outcome.candidates.length} symbols matching '${name}'. Use uid, file_path, or kind to disambiguate.`,
            candidates: outcome.candidates.map((c) => ({
                uid: c.id, name: c.name, kind: c.type, filePath: c.filePath,
                line: c.startLine, score: Number(c.score.toFixed(2)),
            })),
        };
    }
    const sym = outcome.symbol;
    const resolvedLabel = outcome.resolvedLabel;
    const symId = sym.id;
    const incomingRows = await executeParameterized(repo.id, `MATCH (caller)-[r:CodeRelation]->(n {id: $symId})
     WHERE r.type IN ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES', 'HAS_METHOD', 'HAS_PROPERTY', 'METHOD_OVERRIDES', 'OVERRIDES', 'METHOD_IMPLEMENTS', 'ACCESSES']
     RETURN r.type AS relType, caller.id AS uid, caller.name AS name, caller.filePath AS filePath, labels(caller)[0] AS kind
     LIMIT 30`, { symId });
    let typedPropertyRows = [];
    const symRawType = sym.type || sym[2] || '';
    let isClassLike = resolvedLabel === 'Class' || resolvedLabel === 'Interface';
    if (!isClassLike && symRawType === '') {
        try {
            const typeCheck = await executeParameterized(repo.id, `MATCH (n:Class) WHERE n.id = $symId RETURN 'Class' AS label LIMIT 1
         UNION ALL MATCH (n:Interface) WHERE n.id = $symId RETURN 'Interface' AS label LIMIT 1`, { symId });
            isClassLike = typeCheck.length > 0;
        }
        catch { /* not a Class/Interface node */ }
    }
    else if (!isClassLike) {
        isClassLike = symRawType === 'Class' || symRawType === 'Interface';
    }
    if (isClassLike) {
        try {
            const [ctorIncoming, fileIncoming, typedPropertyIncoming, typedProperties] = await Promise.all([
                executeParameterized(repo.id, `MATCH (n)-[hm:CodeRelation]->(ctor:Constructor) WHERE n.id = $symId AND hm.type = 'HAS_METHOD' MATCH (caller)-[r:CodeRelation]->(ctor) WHERE r.type IN ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES', 'ACCESSES'] RETURN r.type AS relType, caller.id AS uid, caller.name AS name, caller.filePath AS filePath, labels(caller)[0] AS kind LIMIT 30`, { symId }),
                executeParameterized(repo.id, `MATCH (f:File)-[rel:CodeRelation]->(n) WHERE n.id = $symId AND rel.type = 'DEFINES' MATCH (caller)-[r:CodeRelation]->(f) WHERE r.type IN ['CALLS', 'IMPORTS'] RETURN r.type AS relType, caller.id AS uid, caller.name AS name, caller.filePath AS filePath, labels(caller)[0] AS kind LIMIT 30`, { symId }),
                executeParameterized(repo.id, `MATCH (p:\`Property\`) WHERE p.declaredType = $name OR p.declaredType STARTS WITH $genericPrefix OR p.declaredType CONTAINS $genericArg MATCH (caller)-[r:CodeRelation]->(p) WHERE r.type IN ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES', 'ACCESSES'] RETURN r.type AS relType, caller.id AS uid, caller.name AS name, caller.filePath AS filePath, labels(caller)[0] AS kind LIMIT 30`, { name: sym.name, genericPrefix: `${sym.name}<`, genericArg: `<${sym.name}>` }),
                executeParameterized(repo.id, `MATCH (p:\`Property\`) WHERE p.declaredType = $name OR p.declaredType STARTS WITH $genericPrefix OR p.declaredType CONTAINS $genericArg RETURN p.id AS uid, p.name AS name, p.filePath AS filePath, labels(p)[0] AS kind, p.declaredType AS declaredType LIMIT 30`, { name: sym.name, genericPrefix: `${sym.name}<`, genericArg: `<${sym.name}>` }),
            ]);
            typedPropertyRows = typedProperties;
            const seenKeys = new Set(incomingRows.map((r) => `${r.relType || r[0]}:${r.uid || r[1]}`));
            for (const r of [...ctorIncoming, ...fileIncoming, ...typedPropertyIncoming]) {
                const key = `${r.relType || r[0]}:${r.uid || r[1]}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    incomingRows.push(r);
                }
            }
        }
        catch (e) {
            logQueryError('context:class-incoming-expansion', e);
        }
    }
    const outgoingRows = await executeParameterized(repo.id, `MATCH (n {id: $symId})-[r:CodeRelation]->(target)
     WHERE r.type IN ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES', 'HAS_METHOD', 'HAS_PROPERTY', 'METHOD_OVERRIDES', 'OVERRIDES', 'METHOD_IMPLEMENTS', 'ACCESSES']
     RETURN r.type AS relType, target.id AS uid, target.name AS name, target.filePath AS filePath, labels(target)[0] AS kind
     LIMIT 30`, { symId });
    let processRows = [];
    try {
        processRows = await executeParameterized(repo.id, `MATCH (n {id: $symId})-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
       RETURN p.id AS pid, p.heuristicLabel AS label, r.step AS step, p.stepCount AS stepCount`, { symId });
    }
    catch (e) {
        logQueryError('context:process-participation', e);
    }
    const symKind = isClassLike ? resolvedLabel || 'Class' : sym.type || sym[2];
    const isMethodLike = symKind === 'Method' || symKind === 'Function' || symKind === 'Constructor';
    let methodMetadata;
    if (isMethodLike) {
        try {
            const metaRows = await executeParameterized(repo.id, `MATCH (n {id: $symId})
         RETURN n.visibility AS visibility, n.isStatic AS isStatic, n.isAbstract AS isAbstract,
                n.isFinal AS isFinal, n.isVirtual AS isVirtual, n.isOverride AS isOverride,
                n.isAsync AS isAsync, n.isPartial AS isPartial, n.returnType AS returnType,
                n.parameterCount AS parameterCount, n.isVariadic AS isVariadic,
                n.requiredParameterCount AS requiredParameterCount,
                n.parameterTypes AS parameterTypes, n.annotations AS annotations LIMIT 1`, { symId });
            if (metaRows.length > 0) {
                const row = metaRows[0];
                const meta = {};
                for (const key of Object.keys(row)) {
                    const val = row[key];
                    if (val !== null && val !== undefined)
                        meta[key] = val;
                }
                if (Object.keys(meta).length > 0)
                    methodMetadata = meta;
            }
        }
        catch { /* method metadata unavailable — omit silently */ }
    }
    return {
        status: 'found',
        symbol: {
            uid: sym.id || sym[0], name: sym.name || sym[1], kind: symKind,
            filePath: sym.filePath || sym[3], startLine: sym.startLine || sym[4],
            endLine: sym.endLine || sym[5],
            ...(include_content && (sym.content || sym[6]) ? { content: sym.content || sym[6] } : {}),
            ...(methodMetadata ? { methodMetadata } : {}),
        },
        incoming: categorize(incomingRows),
        outgoing: categorize(outgoingRows),
        ...(typedPropertyRows.length > 0 ? {
            typed_properties: typedPropertyRows.map((r) => ({
                uid: r.uid || r[0], name: r.name || r[1], filePath: r.filePath || r[2],
                kind: r.kind || r[3], declaredType: r.declaredType || r[4],
            })),
        } : {}),
        processes: processRows.map((r) => ({
            id: r.pid || r[0], name: r.label || r[1], step_index: r.step || r[2], step_count: r.stepCount || r[3],
        })),
    };
}
export async function executeContext(repo, params) {
    try {
        return await _contextImpl(repo, params);
    }
    catch (err) {
        const msg = (err instanceof Error ? err.message : String(err)) || 'Context query failed';
        if (isWalCorruptionError(err))
            return { error: msg, recoverySuggestion: WAL_RECOVERY_SUGGESTION };
        throw err;
    }
}
export async function executeCypher(repo, params) {
    if (!isLbugReady(repo.id))
        return { error: 'LadybugDB not ready. Index may be corrupted.' };
    if (isWriteQuery(params.query)) {
        return { error: 'Write operations (CREATE, DELETE, SET, MERGE, REMOVE, DROP, ALTER, COPY, DETACH) are not allowed. The knowledge graph is read-only.' };
    }
    try {
        return await executeQuery(repo.id, params.query);
    }
    catch (err) {
        const msg = err.message || 'Query failed';
        if (isWalCorruptionError(err))
            return { error: msg, recoverySuggestion: WAL_RECOVERY_SUGGESTION };
        return { error: msg };
    }
}
export function formatCypherAsMarkdown(result) {
    if (!Array.isArray(result) || result.length === 0)
        return result;
    const firstRow = result[0];
    if (typeof firstRow !== 'object' || firstRow === null)
        return result;
    const keys = Object.keys(firstRow);
    if (keys.length === 0)
        return result;
    const header = '| ' + keys.join(' | ') + ' |';
    const separator = '| ' + keys.map(() => '---').join(' | ') + ' |';
    const dataRows = result.map((row) => '| ' + keys.map((k) => {
        const v = row[k];
        if (v === null || v === undefined)
            return '';
        if (typeof v === 'object')
            return JSON.stringify(v);
        return String(v);
    }).join(' | ') + ' |');
    return { markdown: [header, separator, ...dataRows].join('\n'), row_count: result.length };
}
export async function executeOverview(repo, params) {
    const limit = params.limit || 20;
    const result = {
        repo: repo.name, repoPath: repo.repoPath, stats: repo.stats,
        indexedAt: repo.indexedAt, lastCommit: repo.lastCommit,
    };
    if (params.showClusters !== false) {
        try {
            const rawLimit = Math.max(limit * 5, 200);
            const clusters = await executeQuery(repo.id, `MATCH (c:Community)
         RETURN c.id AS id, c.label AS label, c.heuristicLabel AS heuristicLabel, c.cohesion AS cohesion, c.symbolCount AS symbolCount
         ORDER BY c.symbolCount DESC LIMIT ${rawLimit}`);
            const rawClusters = clusters.map((c) => ({
                id: c.id || c[0], label: c.label || c[1], heuristicLabel: c.heuristicLabel || c[2],
                cohesion: c.cohesion || c[3], symbolCount: c.symbolCount || c[4],
            }));
            result.clusters = aggregateClusters(rawClusters).slice(0, limit);
        }
        catch {
            result.clusters = [];
        }
    }
    if (params.showProcesses !== false) {
        try {
            const processes = await executeQuery(repo.id, `MATCH (p:Process)
         RETURN p.id AS id, p.label AS label, p.heuristicLabel AS heuristicLabel, p.processType AS processType, p.stepCount AS stepCount
         ORDER BY p.stepCount DESC LIMIT ${limit}`);
            result.processes = processes.map((p) => ({
                id: p.id || p[0], label: p.label || p[1], heuristicLabel: p.heuristicLabel || p[2],
                processType: p.processType || p[3], stepCount: p.stepCount || p[4],
            }));
        }
        catch {
            result.processes = [];
        }
    }
    return result;
}
export async function executeExplore(repo, params) {
    const { name, type } = params;
    if (type === 'symbol')
        return executeContext(repo, { name });
    if (type === 'cluster') {
        const clusters = await executeParameterized(repo.id, `MATCH (c:Community) WHERE c.label = $clusterName OR c.heuristicLabel = $clusterName
       RETURN c.id AS id, c.label AS label, c.heuristicLabel AS heuristicLabel, c.cohesion AS cohesion, c.symbolCount AS symbolCount`, { clusterName: name });
        if (clusters.length === 0)
            return { error: `Cluster '${name}' not found` };
        const rawClusters = clusters.map((c) => ({
            id: c.id || c[0], label: c.label || c[1], heuristicLabel: c.heuristicLabel || c[2],
            cohesion: c.cohesion || c[3], symbolCount: c.symbolCount || c[4],
        }));
        let totalSymbols = 0, weightedCohesion = 0;
        for (const c of rawClusters) {
            const s = c.symbolCount || 0;
            totalSymbols += s;
            weightedCohesion += (c.cohesion || 0) * s;
        }
        const members = await executeParameterized(repo.id, `MATCH (n)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community)
       WHERE c.label = $clusterName OR c.heuristicLabel = $clusterName
       RETURN DISTINCT n.name AS name, labels(n)[0] AS type, n.filePath AS filePath LIMIT 30`, { clusterName: name });
        return {
            cluster: {
                id: rawClusters[0].id, label: rawClusters[0].heuristicLabel || rawClusters[0].label,
                heuristicLabel: rawClusters[0].heuristicLabel || rawClusters[0].label,
                cohesion: totalSymbols > 0 ? weightedCohesion / totalSymbols : 0,
                symbolCount: totalSymbols, subCommunities: rawClusters.length,
            },
            members: members.map((m) => ({ name: m.name || m[0], type: m.type || m[1], filePath: m.filePath || m[2] })),
        };
    }
    if (type === 'process') {
        const processes = await executeParameterized(repo.id, `MATCH (p:Process) WHERE p.label = $processName OR p.heuristicLabel = $processName
       RETURN p.id AS id, p.label AS label, p.heuristicLabel AS heuristicLabel, p.processType AS processType, p.stepCount AS stepCount LIMIT 1`, { processName: name });
        if (processes.length === 0)
            return { error: `Process '${name}' not found` };
        const proc = processes[0];
        const procId = proc.id || proc[0];
        const steps = await executeParameterized(repo.id, `MATCH (n)-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p {id: $procId})
       RETURN n.name AS name, labels(n)[0] AS type, n.filePath AS filePath, r.step AS step ORDER BY r.step`, { procId });
        return {
            process: {
                id: procId, label: proc.label || proc[1], heuristicLabel: proc.heuristicLabel || proc[2],
                processType: proc.processType || proc[3], stepCount: proc.stepCount || proc[4],
            },
            steps: steps.map((s) => ({ step: s.step || s[3], name: s.name || s[0], type: s.type || s[1], filePath: s.filePath || s[2] })),
        };
    }
    return { error: 'Invalid type. Use: symbol, cluster, or process' };
}
