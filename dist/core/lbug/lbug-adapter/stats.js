import { conn } from './connection.js';
import { NODE_TABLES, REL_TABLE_NAME } from '../schema.js';
import { escapeTableName } from './graph-loader.js';
export const getLbugStats = async () => {
    if (!conn)
        return { nodes: 0, edges: 0 };
    let totalNodes = 0;
    for (const tableName of NODE_TABLES) {
        try {
            const queryResult = await conn.query(`MATCH (n:${escapeTableName(tableName)}) RETURN count(n) AS cnt`);
            const nodeResult = Array.isArray(queryResult) ? queryResult[0] : queryResult;
            const nodeRows = await nodeResult.getAll();
            if (nodeRows.length > 0) {
                totalNodes += Number(nodeRows[0]?.cnt ?? nodeRows[0]?.[0] ?? 0);
            }
        }
        catch {
            // ignore
        }
    }
    let totalEdges = 0;
    try {
        const queryResult = await conn.query(`MATCH ()-[r:${REL_TABLE_NAME}]->() RETURN count(r) AS cnt`);
        const edgeResult = Array.isArray(queryResult) ? queryResult[0] : queryResult;
        const edgeRows = await edgeResult.getAll();
        if (edgeRows.length > 0) {
            totalEdges = Number(edgeRows[0]?.cnt ?? edgeRows[0]?.[0] ?? 0);
        }
    }
    catch {
        // ignore
    }
    return { nodes: totalNodes, edges: totalEdges };
};
