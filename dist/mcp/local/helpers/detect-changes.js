import { executeParameterized } from '../../../core/lbug/pool-adapter.js';
import { parseDiffHunks } from '../../../storage/git.js';
import { logQueryError } from './logging.js';
export async function executeDetectChanges(repo, params) {
    const scope = params.scope || 'unstaged';
    const { execFileSync } = await import('child_process');
    let diffArgs;
    switch (scope) {
        case 'staged':
            diffArgs = ['diff', '--staged', '-U0'];
            break;
        case 'all':
            diffArgs = ['diff', 'HEAD', '-U0'];
            break;
        case 'compare':
            if (!params.base_ref)
                return { error: 'base_ref is required for "compare" scope' };
            diffArgs = ['diff', params.base_ref, '-U0'];
            break;
        case 'unstaged':
        default:
            diffArgs = ['diff', '-U0'];
            break;
    }
    let diffOutput;
    try {
        diffOutput = execFileSync('git', diffArgs, {
            cwd: repo.repoPath, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024,
        });
    }
    catch (err) {
        return { error: `Git diff failed: ${err.message}` };
    }
    const fileDiffs = parseDiffHunks(diffOutput);
    if (fileDiffs.length === 0) {
        return {
            summary: { changed_count: 0, affected_count: 0, risk_level: 'none', message: 'No changes detected.' },
            changed_symbols: [], affected_processes: [],
        };
    }
    const changedSymbols = [];
    for (const fileDiff of fileDiffs) {
        if (fileDiff.hunks.length === 0)
            continue;
        const overlapConditions = fileDiff.hunks
            .map((_, i) => `(n.startLine <= $hunkEnd${i} AND n.endLine >= $hunkStart${i})`)
            .join(' OR ');
        const queryParams = { filePath: fileDiff.filePath };
        fileDiff.hunks.forEach((hunk, i) => {
            queryParams[`hunkStart${i}`] = hunk.startLine;
            queryParams[`hunkEnd${i}`] = hunk.endLine;
        });
        const symbolQuery = `MATCH (n) WHERE n.filePath ENDS WITH $filePath AND n.startLine IS NOT NULL AND n.endLine IS NOT NULL AND (${overlapConditions}) RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine`;
        try {
            const rows = await executeParameterized(repo.id, symbolQuery, queryParams);
            for (const sym of rows) {
                changedSymbols.push({
                    id: sym.id || sym[0], name: sym.name || sym[1], type: sym.type || sym[2],
                    filePath: sym.filePath || sym[3], change_type: 'touched',
                });
            }
        }
        catch (e) {
            logQueryError('detect-changes:file-symbols', e);
        }
    }
    const affectedProcesses = new Map();
    if (changedSymbols.length > 0) {
        const symIds = changedSymbols.map((s) => s.id);
        const symNameById = new Map(changedSymbols.map((s) => [s.id, s.name]));
        try {
            const procs = await executeParameterized(repo.id, `MATCH (n)-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process) WHERE n.id IN $ids RETURN n.id AS nodeId, p.id AS pid, p.heuristicLabel AS label, p.processType AS processType, p.stepCount AS stepCount, r.step AS step`, { ids: symIds });
            for (const proc of procs) {
                const nodeId = proc.nodeId || proc[0];
                const pid = proc.pid || proc[1];
                if (!affectedProcesses.has(pid)) {
                    affectedProcesses.set(pid, {
                        id: pid, name: proc.label || proc[2], process_type: proc.processType || proc[3],
                        step_count: proc.stepCount || proc[4], changed_steps: [],
                    });
                }
                affectedProcesses.get(pid).changed_steps.push({ symbol: symNameById.get(nodeId) ?? nodeId, step: proc.step || proc[5] });
            }
        }
        catch (e) {
            logQueryError('detect-changes:process-lookup', e);
        }
    }
    const processCount = affectedProcesses.size;
    const risk = processCount === 0 ? 'low' : processCount <= 5 ? 'medium' : processCount <= 15 ? 'high' : 'critical';
    return {
        summary: { changed_count: changedSymbols.length, affected_count: processCount, changed_files: fileDiffs.length, risk_level: risk },
        changed_symbols: changedSymbols, affected_processes: Array.from(affectedProcesses.values()),
    };
}
