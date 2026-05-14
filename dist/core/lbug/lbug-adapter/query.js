import { conn } from './connection.js';
export const executeQuery = async (cypher) => {
    if (!conn) {
        throw new Error('LadybugDB not initialized. Call initLbug first.');
    }
    const queryResult = await conn.query(cypher);
    const result = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    const rows = await result.getAll();
    return rows;
};
export const streamQuery = async (cypher, onRow) => {
    if (!conn) {
        throw new Error('LadybugDB not initialized. Call initLbug first.');
    }
    const queryResult = await conn.query(cypher);
    const result = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    let rowCount = 0;
    try {
        while (await result.hasNext()) {
            const row = await result.getNext();
            await onRow(row);
            rowCount++;
        }
        return rowCount;
    }
    finally {
        try {
            await result.close();
        }
        catch {
            // Best-effort cleanup only.
        }
    }
};
export const executePrepared = async (cypher, params) => {
    if (!conn) {
        throw new Error('LadybugDB not initialized. Call initLbug first.');
    }
    const stmt = await conn.prepare(cypher);
    if (!stmt.isSuccess()) {
        const errMsg = await stmt.getErrorMessage();
        throw new Error(`Prepare failed: ${errMsg}`);
    }
    const queryResult = await conn.execute(stmt, params);
    const result = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    return await result.getAll();
};
export const executeWithReusedStatement = async (cypher, paramsList) => {
    if (!conn) {
        throw new Error('LadybugDB not initialized. Call initLbug first.');
    }
    if (paramsList.length === 0)
        return;
    const SUB_BATCH_SIZE = 4;
    for (let i = 0; i < paramsList.length; i += SUB_BATCH_SIZE) {
        const subBatch = paramsList.slice(i, i + SUB_BATCH_SIZE);
        const stmt = await conn.prepare(cypher);
        if (!stmt.isSuccess()) {
            const errMsg = await stmt.getErrorMessage();
            throw new Error(`Prepare failed: ${errMsg}`);
        }
        try {
            for (const params of subBatch) {
                await conn.execute(stmt, params);
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const queryPreview = cypher.replace(/\s+/g, ' ').slice(0, 120);
            throw new Error(`Batch execution failed for rows ${i + 1}-${i + subBatch.length}: ${msg} (${queryPreview})`);
        }
    }
};
