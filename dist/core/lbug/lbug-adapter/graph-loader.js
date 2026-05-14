import fs from 'fs/promises';
import { finished } from 'stream/promises';
import path from 'path';
import { conn } from './connection.js';
import { normalizeCopyPath } from './helpers/path-utils.js';
import { splitRelCsvByLabelPair } from './csv-split.js';
import { NODE_TABLES, REL_TABLE_NAME } from '../schema.js';
import { streamAllCSVsToDisk } from '../csv-generator.js';
const COPY_CSV_OPTS = `(HEADER=true, ESCAPE='"', DELIM=',', QUOTE='"', PARALLEL=false, auto_detect=false)`;
const BACKTICK_TABLES = new Set([
    'Struct',
    'Enum',
    'Macro',
    'Typedef',
    'Union',
    'Namespace',
    'Trait',
    'Impl',
    'TypeAlias',
    'Const',
    'Static',
    'Property',
    'Record',
    'Delegate',
    'Annotation',
    'Constructor',
    'Template',
    'Module',
]);
export const escapeTableName = (table) => {
    return BACKTICK_TABLES.has(table) ? `\`${table}\`` : table;
};
export const TABLES_WITH_EXPORTED = new Set([
    'Function',
    'Class',
    'Interface',
    'Method',
    'CodeElement',
]);
const getCopyQuery = (table, filePath) => {
    const t = escapeTableName(table);
    if (table === 'File') {
        return `COPY ${t}(id, name, filePath, content) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Folder') {
        return `COPY ${t}(id, name, filePath) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Community') {
        return `COPY ${t}(id, label, heuristicLabel, keywords, description, enrichedBy, cohesion, symbolCount) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Process') {
        return `COPY ${t}(id, label, heuristicLabel, processType, stepCount, communities, entryPointId, terminalId) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Section') {
        return `COPY ${t}(id, name, filePath, startLine, endLine, level, content, description) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Route') {
        return `COPY ${t}(id, name, filePath, responseKeys, errorKeys, middleware) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Tool') {
        return `COPY ${t}(id, name, filePath, description) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Method') {
        return `COPY ${t}(id, name, filePath, startLine, endLine, isExported, content, description, parameterCount, returnType) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (table === 'Property') {
        return `COPY ${t}(id, name, filePath, startLine, endLine, content, description, declaredType) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    if (TABLES_WITH_EXPORTED.has(table)) {
        return `COPY ${t}(id, name, filePath, startLine, endLine, isExported, content, description) FROM "${filePath}" ${COPY_CSV_OPTS}`;
    }
    return `COPY ${t}(id, name, filePath, startLine, endLine, content, description) FROM "${filePath}" ${COPY_CSV_OPTS}`;
};
const fallbackRelationshipInserts = async (validRelLines, validTables, getNodeLabel) => {
    if (!conn)
        return;
    const escapeLabel = (label) => {
        return BACKTICK_TABLES.has(label) ? `\`${label}\`` : label;
    };
    for (let i = 1; i < validRelLines.length; i++) {
        const line = validRelLines[i];
        try {
            const match = line.match(/"([^"]*)","([^"]*)","([^"]*)",([0-9.]+),"([^"]*)",([0-9-]+)/);
            if (!match)
                continue;
            const [, fromId, toId, relType, confidenceStr, reason, stepStr] = match;
            const fromLabel = getNodeLabel(fromId);
            const toLabel = getNodeLabel(toId);
            if (!validTables.has(fromLabel) || !validTables.has(toLabel))
                continue;
            const confidence = parseFloat(confidenceStr) || 1.0;
            const step = parseInt(stepStr) || 0;
            const esc = (s) => s.replace(/'/g, "''").replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            await conn.query(`
        MATCH (a:${escapeLabel(fromLabel)} {id: '${esc(fromId)}' }),
              (b:${escapeLabel(toLabel)} {id: '${esc(toId)}' })
        CREATE (a)-[:${REL_TABLE_NAME} {type: '${esc(relType)}', confidence: ${confidence}, reason: '${esc(reason)}', step: ${step}}]->(b)
      `);
        }
        catch {
            // skip
        }
    }
};
export const loadGraphToLbug = async (graph, repoPath, storagePath, onProgress) => {
    if (!conn) {
        throw new Error('LadybugDB not initialized. Call initLbug first.');
    }
    const log = onProgress || (() => { });
    const csvDir = path.join(storagePath, 'csv');
    log('Streaming CSVs to disk...');
    const csvResult = await streamAllCSVsToDisk(graph, repoPath, csvDir);
    const validTables = new Set(NODE_TABLES);
    const getNodeLabel = (nodeId) => {
        if (nodeId.startsWith('comm_'))
            return 'Community';
        if (nodeId.startsWith('proc_'))
            return 'Process';
        return nodeId.split(':')[0];
    };
    const nodeFiles = [...csvResult.nodeFiles.entries()];
    const totalSteps = nodeFiles.length + 1;
    let stepsDone = 0;
    for (const [table, { csvPath, rows }] of nodeFiles) {
        stepsDone++;
        log(`Loading nodes ${stepsDone}/${totalSteps}: ${table} (${rows.toLocaleString()} rows)`);
        const normalizedPath = normalizeCopyPath(csvPath);
        const copyQuery = getCopyQuery(table, normalizedPath);
        try {
            await conn.query(copyQuery);
        }
        catch (err) {
            try {
                const retryQuery = copyQuery.replace('auto_detect=false)', 'auto_detect=false, IGNORE_ERRORS=true)');
                await conn.query(retryQuery);
            }
            catch (retryErr) {
                const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                throw new Error(`COPY failed for ${table}: ${retryMsg.slice(0, 200)}`);
            }
        }
    }
    const { relHeader, relsByPairMeta, pairWriteStreams, skippedRels, totalValidRels } = await splitRelCsvByLabelPair(csvResult.relCsvPath, csvDir, validTables, getNodeLabel);
    await Promise.all(Array.from(pairWriteStreams.values()).map(async (ws) => {
        ws.end();
        await finished(ws);
    }));
    const insertedRels = totalValidRels;
    const warnings = [];
    if (insertedRels > 0) {
        log(`Loading edges: ${insertedRels.toLocaleString()} across ${relsByPairMeta.size} types`);
        let pairIdx = 0;
        let failedPairEdges = 0;
        const failedPairCsvPaths = new Set();
        for (const [pairKey, { csvPath: pairCsvPath, rows }] of relsByPairMeta) {
            pairIdx++;
            const [fromLabel, toLabel] = pairKey.split('|');
            const normalizedPath = normalizeCopyPath(pairCsvPath);
            const copyQuery = `COPY ${REL_TABLE_NAME} FROM "${normalizedPath}" (from="${fromLabel}", to="${toLabel}", HEADER=true, ESCAPE='"', DELIM=',', QUOTE='"', PARALLEL=false, auto_detect=false)`;
            if (pairIdx % 5 === 0 || rows > 1000) {
                log(`Loading edges: ${pairIdx}/${relsByPairMeta.size} types (${fromLabel} -> ${toLabel})`);
            }
            try {
                await conn.query(copyQuery);
            }
            catch (err) {
                try {
                    const retryQuery = copyQuery.replace('auto_detect=false)', 'auto_detect=false, IGNORE_ERRORS=true)');
                    await conn.query(retryQuery);
                }
                catch (retryErr) {
                    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    warnings.push(`${fromLabel}->${toLabel} (${rows} edges): ${retryMsg.slice(0, 80)}`);
                    failedPairEdges += rows;
                    failedPairCsvPaths.add(pairCsvPath);
                }
            }
            if (!failedPairCsvPaths.has(pairCsvPath)) {
                try {
                    await fs.unlink(pairCsvPath);
                }
                catch { }
            }
        }
        if (failedPairCsvPaths.size > 0) {
            log(`Inserting ${failedPairEdges} edges individually (missing schema pairs)`);
            const allLines = [relHeader];
            for (const failedPath of failedPairCsvPaths) {
                try {
                    const content = await fs.readFile(failedPath, 'utf-8');
                    const lines = content.split('\n');
                    for (let i = 1; i < lines.length; i++) {
                        if (lines[i].trim())
                            allLines.push(lines[i]);
                    }
                }
                catch { }
                try {
                    await fs.unlink(failedPath);
                }
                catch { }
            }
            if (allLines.length > 1) {
                await fallbackRelationshipInserts(allLines, validTables, getNodeLabel);
            }
        }
    }
    try {
        await fs.unlink(csvResult.relCsvPath);
    }
    catch { }
    for (const [, { csvPath }] of csvResult.nodeFiles) {
        try {
            await fs.unlink(csvPath);
        }
        catch { }
    }
    try {
        const remaining = await fs.readdir(csvDir);
        for (const f of remaining) {
            try {
                await fs.unlink(path.join(csvDir, f));
            }
            catch { }
        }
    }
    catch { }
    try {
        await fs.rmdir(csvDir);
    }
    catch { }
    return { success: true, insertedRels, skippedRels, warnings };
};
