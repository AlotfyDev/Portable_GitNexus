import { conn, db } from './connection.js';
import { escapeTableName, TABLES_WITH_EXPORTED } from './graph-loader.js';
import { NODE_TABLES, EMBEDDING_TABLE_NAME } from '../schema.js';
import { openLbugConnection, closeLbugConnection, } from '../lbug-config.js';
import lbug from '@ladybugdb/core';
import { logger } from '../../logger.js';
export const insertNodeToLbug = async (label, properties, dbPath) => {
    const targetDbPath = dbPath || (db ? undefined : null);
    if (!targetDbPath && !conn) {
        throw new Error('LadybugDB not initialized. Provide dbPath or call initLbug first.');
    }
    try {
        const escapeValue = (v) => {
            if (v === null || v === undefined)
                return 'NULL';
            if (typeof v === 'number')
                return String(v);
            return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
        };
        const t = escapeTableName(label);
        let query;
        if (label === 'File') {
            query = `CREATE (n:File {id: ${escapeValue(properties.id)}, name: ${escapeValue(properties.name)}, filePath: ${escapeValue(properties.filePath)}, content: ${escapeValue(properties.content || '')}})`;
        }
        else if (label === 'Folder') {
            query = `CREATE (n:Folder {id: ${escapeValue(properties.id)}, name: ${escapeValue(properties.name)}, filePath: ${escapeValue(properties.filePath)}})`;
        }
        else if (label === 'Section') {
            const descPart = properties.description
                ? `, description: ${escapeValue(properties.description)}`
                : '';
            query = `CREATE (n:Section {id: ${escapeValue(properties.id)}, name: ${escapeValue(properties.name)}, filePath: ${escapeValue(properties.filePath)}, startLine: ${properties.startLine || 0}, endLine: ${properties.endLine || 0}, level: ${properties.level || 1}, content: ${escapeValue(properties.content || '')}${descPart}})`;
        }
        else if (TABLES_WITH_EXPORTED.has(label)) {
            const descPart = properties.description
                ? `, description: ${escapeValue(properties.description)}`
                : '';
            query = `CREATE (n:${t} {id: ${escapeValue(properties.id)}, name: ${escapeValue(properties.name)}, filePath: ${escapeValue(properties.filePath)}, startLine: ${properties.startLine || 0}, endLine: ${properties.endLine || 0}, isExported: ${!!properties.isExported}, content: ${escapeValue(properties.content || '')}${descPart}})`;
        }
        else if (label === 'Property') {
            const descPart = properties.description
                ? `, description: ${escapeValue(properties.description)}`
                : '';
            query = `CREATE (n:${t} {id: ${escapeValue(properties.id)}, name: ${escapeValue(properties.name)}, filePath: ${escapeValue(properties.filePath)}, startLine: ${properties.startLine || 0}, endLine: ${properties.endLine || 0}, content: ${escapeValue(properties.content || '')}${descPart}, declaredType: ${escapeValue(properties.declaredType || '')}})`;
        }
        else {
            const descPart = properties.description
                ? `, description: ${escapeValue(properties.description)}`
                : '';
            query = `CREATE (n:${t} {id: ${escapeValue(properties.id)}, name: ${escapeValue(properties.name)}, filePath: ${escapeValue(properties.filePath)}, startLine: ${properties.startLine || 0}, endLine: ${properties.endLine || 0}, content: ${escapeValue(properties.content || '')}${descPart}})`;
        }
        if (targetDbPath) {
            const tempHandle = await openLbugConnection(lbug, targetDbPath);
            try {
                await tempHandle.conn.query(query);
                return true;
            }
            finally {
                await closeLbugConnection(tempHandle);
            }
        }
        else if (conn) {
            await conn.query(query);
            return true;
        }
        return false;
    }
    catch (e) {
        logger.error({ err: e.message }, `Failed to insert ${label} node:`);
        return false;
    }
};
export const batchInsertNodesToLbug = async (nodes, dbPath) => {
    if (nodes.length === 0)
        return { inserted: 0, failed: 0 };
    const escapeValue = (v) => {
        if (v === null || v === undefined)
            return 'NULL';
        if (typeof v === 'number')
            return String(v);
        return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
    };
    const tempHandle = await openLbugConnection(lbug, dbPath);
    const tempConn = tempHandle.conn;
    let inserted = 0;
    let failed = 0;
    try {
        for (const { label, properties } of nodes) {
            try {
                let query;
                const t = escapeTableName(label);
                if (label === 'File') {
                    query = `MERGE (n:File {id: ${escapeValue(properties.id)}}) SET n.name = ${escapeValue(properties.name)}, n.filePath = ${escapeValue(properties.filePath)}, n.content = ${escapeValue(properties.content || '')}`;
                }
                else if (label === 'Folder') {
                    query = `MERGE (n:Folder {id: ${escapeValue(properties.id)}}) SET n.name = ${escapeValue(properties.name)}, n.filePath = ${escapeValue(properties.filePath)}`;
                }
                else if (label === 'Section') {
                    const descPart = properties.description
                        ? `, n.description = ${escapeValue(properties.description)}`
                        : '';
                    query = `MERGE (n:Section {id: ${escapeValue(properties.id)}}) SET n.name = ${escapeValue(properties.name)}, n.filePath = ${escapeValue(properties.filePath)}, n.startLine = ${properties.startLine || 0}, n.endLine = ${properties.endLine || 0}, n.level = ${properties.level || 1}, n.content = ${escapeValue(properties.content || '')}${descPart}`;
                }
                else if (TABLES_WITH_EXPORTED.has(label)) {
                    const descPart = properties.description
                        ? `, n.description = ${escapeValue(properties.description)}`
                        : '';
                    query = `MERGE (n:${t} {id: ${escapeValue(properties.id)}}) SET n.name = ${escapeValue(properties.name)}, n.filePath = ${escapeValue(properties.filePath)}, n.startLine = ${properties.startLine || 0}, n.endLine = ${properties.endLine || 0}, n.isExported = ${!!properties.isExported}, n.content = ${escapeValue(properties.content || '')}${descPart}`;
                }
                else if (label === 'Property') {
                    const descPart = properties.description
                        ? `, n.description = ${escapeValue(properties.description)}`
                        : '';
                    query = `MERGE (n:${t} {id: ${escapeValue(properties.id)}}) SET n.name = ${escapeValue(properties.name)}, n.filePath = ${escapeValue(properties.filePath)}, n.startLine = ${properties.startLine || 0}, n.endLine = ${properties.endLine || 0}, n.content = ${escapeValue(properties.content || '')}${descPart}, n.declaredType = ${escapeValue(properties.declaredType || '')}`;
                }
                else {
                    const descPart = properties.description
                        ? `, n.description = ${escapeValue(properties.description)}`
                        : '';
                    query = `MERGE (n:${t} {id: ${escapeValue(properties.id)}}) SET n.name = ${escapeValue(properties.name)}, n.filePath = ${escapeValue(properties.filePath)}, n.startLine = ${properties.startLine || 0}, n.endLine = ${properties.endLine || 0}, n.content = ${escapeValue(properties.content || '')}${descPart}`;
                }
                await tempConn.query(query);
                inserted++;
            }
            catch {
                failed++;
            }
        }
    }
    finally {
        await closeLbugConnection(tempHandle);
    }
    return { inserted, failed };
};
export const deleteNodesForFile = async (filePath, dbPath) => {
    const usePerQuery = !!dbPath;
    let tempHandle = null;
    let tempConn = null;
    let targetConn = conn;
    if (usePerQuery) {
        tempHandle = await openLbugConnection(lbug, dbPath);
        tempConn = tempHandle.conn;
        targetConn = tempConn;
    }
    else if (!conn) {
        throw new Error('LadybugDB not initialized. Provide dbPath or call initLbug first.');
    }
    try {
        let deletedNodes = 0;
        const escapedPath = filePath.replace(/'/g, "''");
        for (const tableName of NODE_TABLES) {
            if (tableName === 'Community' || tableName === 'Process')
                continue;
            try {
                const tn = escapeTableName(tableName);
                const countResult = await targetConn.query(`MATCH (n:${tn}) WHERE n.filePath = '${escapedPath}' RETURN count(n) AS cnt`);
                const result = Array.isArray(countResult) ? countResult[0] : countResult;
                const rows = await result.getAll();
                const count = Number(rows[0]?.cnt ?? rows[0]?.[0] ?? 0);
                if (count > 0) {
                    await targetConn.query(`MATCH (n:${tn}) WHERE n.filePath = '${escapedPath}' DETACH DELETE n`);
                    deletedNodes += count;
                }
            }
            catch {
                // skip
            }
        }
        try {
            await targetConn.query(`MATCH (e:${EMBEDDING_TABLE_NAME}) WHERE e.nodeId STARTS WITH '${escapedPath}' DELETE e`);
        }
        catch {
            // Embedding table may not exist
        }
        return { deletedNodes };
    }
    finally {
        if (tempHandle)
            await closeLbugConnection(tempHandle);
    }
};
