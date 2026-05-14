import { EMBEDDING_TABLE_NAME, EMBEDDING_INDEX_NAME, CREATE_VECTOR_INDEX_QUERY, STALE_HASH_SENTINEL } from '../lbug/schema.js';
import { loadVectorExtension } from '../lbug/lbug-adapter.js';
export class LadybugVectorProvider {
    executeQuery;
    executeBatch;
    tableName;
    indexName;
    name = 'ladybug-vector';
    capabilities = {
        similaritySearch: true,
        hybridSearch: false,
        metadata: true,
        maxDimensions: 384,
        persistent: true,
        windowsCompatible: false,
        requiresExternalServer: false,
    };
    constructor(executeQuery, executeBatch, tableName = EMBEDDING_TABLE_NAME, indexName = EMBEDDING_INDEX_NAME) {
        this.executeQuery = executeQuery;
        this.executeBatch = executeBatch;
        this.tableName = tableName;
        this.indexName = indexName;
    }
    async init() {
        await this.ensureVectorIndex();
    }
    async store(records) {
        if (records.length === 0)
            return;
        const cypher = `CREATE (e:${this.tableName} {id: $id, nodeId: $nodeId, chunkIndex: $chunkIndex, startLine: $startLine, endLine: $endLine, embedding: $embedding, contentHash: $contentHash})`;
        const paramsList = records.map((r) => ({
            id: r.id,
            nodeId: r.metadata?.nodeId ?? r.id,
            chunkIndex: r.metadata?.chunkIndex ?? 0,
            startLine: r.metadata?.startLine ?? 0,
            endLine: r.metadata?.endLine ?? 0,
            embedding: r.vector,
            contentHash: r.metadata?.contentHash ?? STALE_HASH_SENTINEL,
        }));
        await this.executeBatch(cypher, paramsList);
    }
    async search(vector, options) {
        const queryVecStr = `[${vector.join(',')}]`;
        const distanceThreshold = options.minScore ?? 0.5;
        const cypher = `
      CALL QUERY_VECTOR_INDEX('${this.tableName}', '${this.indexName}',
        CAST(${queryVecStr} AS FLOAT[${vector.length}]), ${options.topK})
      YIELD node AS emb, distance
      WITH emb, distance
      WHERE distance < ${distanceThreshold}
      RETURN emb.nodeId AS nodeId, emb.chunkIndex AS chunkIndex,
             emb.startLine AS startLine, emb.endLine AS endLine, distance
      ORDER BY distance
    `;
        const rows = await this.executeQuery(cypher);
        return rows.map((row) => ({
            id: row.nodeId ?? row[0],
            score: row.distance ?? row[4],
            metadata: {
                chunkIndex: row.chunkIndex ?? row[1] ?? 0,
                startLine: row.startLine ?? row[2] ?? 0,
                endLine: row.endLine ?? row[3] ?? 0,
            },
        }));
    }
    async delete(ids) {
        if (ids.length === 0)
            return;
        const cypher = `MATCH (e:${this.tableName} {nodeId: $nodeId}) DELETE e`;
        await this.executeBatch(cypher, ids.map((id) => ({ nodeId: id })));
    }
    async count() {
        const rows = await this.executeQuery(`MATCH (e:${this.tableName}) RETURN count(e) AS cnt`);
        return Number(rows[0]?.cnt ?? rows[0]?.[0] ?? 0);
    }
    async clear() {
        await this.executeQuery(`MATCH (e:${this.tableName}) DELETE e`);
    }
    async health() {
        try {
            const rows = await this.executeQuery('RETURN 1');
            return rows !== undefined;
        }
        catch {
            return false;
        }
    }
    async dispose() {
        // LadybugDB connection is managed externally
    }
    async ensureVectorIndex() {
        const vectorReady = await loadVectorExtension();
        if (!vectorReady)
            return;
        try {
            await this.executeQuery(CREATE_VECTOR_INDEX_QUERY);
        }
        catch {
            // index may already exist
        }
    }
}
