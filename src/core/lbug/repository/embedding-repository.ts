import type { GraphNode } from './types.js';
import {
  EMBEDDING_TABLE_NAME,
  EMBEDDING_INDEX_NAME,
  CREATE_VECTOR_INDEX_QUERY,
  STALE_HASH_SENTINEL,
  EMBEDDING_DIMS,
} from '../schema.js';
import { DatabaseProviderRegistry } from '../../storage/registry.js';
import { LoggerProviderRegistry } from '../../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();

const db = DatabaseProviderRegistry.getProvider('ladybug');
import {
  EMBEDDABLE_LABELS,
  LABEL_METHOD,
  LABELS_WITH_EXPORTED,
} from '../../embeddings/types.js';
import type { IVecDBProvider } from '../../vector-store/provider.js';

const isDev = process.env.NODE_ENV === 'development';

export interface EmbeddingRepository {
  /** Find all embeddable nodes from node tables */
  findUnprocessedNodes(limit: number): Promise<GraphNode[]>;

  /** Store embedding for a node */
  storeEmbedding(
    nodeId: string,
    embedding: number[],
    modelId?: string,
    dimensions?: number,
    hash?: string,
  ): Promise<void>;

  /** Batch store embeddings (chunk-aware: nodeId, chunkIndex, startLine, endLine, embedding, contentHash) */
  batchStoreEmbeddings(
    updates: Array<{
      nodeId: string;
      chunkIndex: number;
      startLine: number;
      endLine: number;
      embedding: number[];
      contentHash?: string;
    }>,
  ): Promise<void>;

  /** Delete embeddings for the given node IDs (DELETE-then-INSERT pattern for Kuzu vector-indexed rows) */
  deleteEmbeddingsByNodeId(nodeIds: string[]): Promise<void>;

  /** Semantic search via vector index — returns raw vector search results (nodeId, score) */
  semanticSearch(
    vector: number[],
    topK: number,
    maxDistance?: number,
  ): Promise<Array<{ nodeId: string; chunkIndex: number; startLine: number; endLine: number; score: number }>>;

  /** Count total embedded nodes */
  countEmbeddings(): Promise<number>;

  /** Fetch all embeddings for exact-scan fallback */
  getAllEmbeddingsForExactScan(): Promise<
    Array<{
      nodeId: string;
      chunkIndex: number;
      startLine: number;
      endLine: number;
      embedding: number[];
    }>
  >;

  /** Query nodes by label and IDs for metadata enrichment */
  queryNodesByIds(
    label: string,
    ids: string[],
  ): Promise<Array<Record<string, unknown>>>;

  /** Check if vector extension is loaded and usable */
  isVectorIndexReady(): Promise<boolean>;

  /** Initialize vector extension and create vector index */
  initializeVectorIndex(): Promise<boolean>;

  /** Cleanup */
  dispose(): Promise<void>;
}

export class LadybugEmbeddingRepository implements EmbeddingRepository {
  private initialized = false;

  constructor(
    private readonly executeQuery: (cypher: string) => Promise<any[]>,
    private readonly executeWithReusedStatement: (
      cypher: string,
      paramsList: Array<Record<string, any>>,
    ) => Promise<void>,
    private readonly tableName: string = EMBEDDING_TABLE_NAME,
    private readonly indexName: string = EMBEDDING_INDEX_NAME,
    private readonly vectorProvider?: IVecDBProvider,
  ) {}

  async findUnprocessedNodes(_limit: number): Promise<GraphNode[]> {
    const allNodes: GraphNode[] = [];

    for (const label of EMBEDDABLE_LABELS) {
      try {
        let query: string;

        if (label === LABEL_METHOD) {
          query = `
            MATCH (n:Method)
            RETURN n.id AS id, n.name AS name, 'Method' AS type,
                   n.filePath AS filePath, n.content AS content,
                   n.startLine AS startLine, n.endLine AS endLine,
                   n.isExported AS isExported, n.description AS description,
                   n.parameterCount AS parameterCount, n.returnType AS returnType
          `;
        } else if (LABELS_WITH_EXPORTED.has(label)) {
          query = `
            MATCH (n:\`${label}\`)
            RETURN n.id AS id, n.name AS name, '${label}' AS type,
                   n.filePath AS filePath, n.content AS content,
                   n.startLine AS startLine, n.endLine AS endLine,
                   n.isExported AS isExported, n.description AS description
          `;
        } else {
          query = `
            MATCH (n:\`${label}\`)
            RETURN n.id AS id, n.name AS name, '${label}' AS type,
                   n.filePath AS filePath, n.content AS content,
                   n.startLine AS startLine, n.endLine AS endLine,
                   n.description AS description
          `;
        }

        const rows = await this.executeQuery(query);
        for (const row of rows) {
          const node: GraphNode = {
            id: row.id ?? row[0],
            type: row.type ?? row[2] ?? label,
            name: row.name ?? row[1],
            filePath: row.filePath ?? row[3],
            content: row.content ?? row[4] ?? '',
            startLine: row.startLine ?? row[5],
            endLine: row.endLine ?? row[6],
          };
          const hasExportedColumn =
            label === LABEL_METHOD || LABELS_WITH_EXPORTED.has(label);
          if (hasExportedColumn) {
            node.isExported = row.isExported ?? row[7];
            node.description = row.description ?? row[8];
          } else {
            node.description = row.description ?? row[7];
          }
          if (label === LABEL_METHOD) {
            node.parameterCount = row.parameterCount ?? row[9];
            node.returnType = row.returnType ?? row[10];
          }
          allNodes.push(node);
        }
      } catch (error) {
        logger.warn({ error }, `Query for ${label} nodes failed:`);
      }
    }

    return allNodes;
  }

  async storeEmbedding(
    nodeId: string,
    embedding: number[],
    _modelId?: string,
    _dimensions?: number,
    hash?: string,
  ): Promise<void> {
    if (this.vectorProvider) {
      await this.vectorProvider.store([
        {
          id: `${nodeId}:0`,
          vector: embedding,
          metadata: { nodeId, chunkIndex: 0, startLine: 0, endLine: 0, contentHash: hash },
        },
      ]);
      return;
    }
    const cypher = `CREATE (e:${this.tableName} {id: $id, nodeId: $nodeId, chunkIndex: 0, startLine: 0, endLine: 0, embedding: $embedding, contentHash: $contentHash})`;
    await this.executeWithReusedStatement(cypher, [
      {
        id: `${nodeId}:0`,
        nodeId,
        chunkIndex: 0,
        startLine: 0,
        endLine: 0,
        embedding,
        contentHash: hash ?? STALE_HASH_SENTINEL,
      },
    ]);
  }

  async batchStoreEmbeddings(
    updates: Array<{
      nodeId: string;
      chunkIndex: number;
      startLine: number;
      endLine: number;
      embedding: number[];
      contentHash?: string;
    }>,
  ): Promise<void> {
    if (this.vectorProvider) {
      await this.vectorProvider.store(
        updates.map((u) => ({
          id: `${u.nodeId}:${u.chunkIndex}`,
          vector: u.embedding,
          metadata: {
            nodeId: u.nodeId,
            chunkIndex: u.chunkIndex,
            startLine: u.startLine,
            endLine: u.endLine,
            contentHash: u.contentHash,
          },
        })),
      );
      return;
    }
    const cypher = `CREATE (e:${this.tableName} {id: $id, nodeId: $nodeId, chunkIndex: $chunkIndex, startLine: $startLine, endLine: $endLine, embedding: $embedding, contentHash: $contentHash})`;
    const paramsList = updates.map((u) => ({
      id: `${u.nodeId}:${u.chunkIndex}`,
      nodeId: u.nodeId,
      chunkIndex: u.chunkIndex,
      startLine: u.startLine,
      endLine: u.endLine,
      embedding: u.embedding,
      contentHash: u.contentHash ?? STALE_HASH_SENTINEL,
    }));
    await this.executeWithReusedStatement(cypher, paramsList);
  }

  async deleteEmbeddingsByNodeId(nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) return;
    if (this.vectorProvider) {
      await this.vectorProvider.delete(nodeIds);
      return;
    }
    await this.executeWithReusedStatement(
      `MATCH (e:${this.tableName} {nodeId: $nodeId}) DELETE e`,
      nodeIds.map((nodeId) => ({ nodeId })),
    );
  }

  async semanticSearch(
    vector: number[],
    topK: number,
    maxDistance: number = 0.5,
  ): Promise<
    Array<{
      nodeId: string;
      chunkIndex: number;
      startLine: number;
      endLine: number;
      score: number;
    }>
  > {
    if (this.vectorProvider) {
      const results = await this.vectorProvider.search(vector, {
        topK,
        minScore: maxDistance,
      });
      return results.map((r) => ({
        nodeId: r.id,
        chunkIndex: (r.metadata?.chunkIndex as number) ?? 0,
        startLine: (r.metadata?.startLine as number) ?? 0,
        endLine: (r.metadata?.endLine as number) ?? 0,
        score: r.score,
      }));
    }
    const queryVecStr = `[${vector.join(',')}]`;
    const vectorQuery = `
      CALL QUERY_VECTOR_INDEX('${this.tableName}', '${this.indexName}',
        CAST(${queryVecStr} AS FLOAT[${vector.length}]), ${topK})
      YIELD node AS emb, distance
      WITH emb, distance
      WHERE distance < ${maxDistance}
      RETURN emb.nodeId AS nodeId, emb.chunkIndex AS chunkIndex,
             emb.startLine AS startLine, emb.endLine AS endLine, distance
      ORDER BY distance
    `;
    const embResults = await this.executeQuery(vectorQuery);
    return embResults.map((row) => ({
      nodeId: row.nodeId ?? row[0],
      chunkIndex: row.chunkIndex ?? row[1] ?? 0,
      startLine: row.startLine ?? row[2] ?? 0,
      endLine: row.endLine ?? row[3] ?? 0,
      score: row.distance ?? row[4],
    }));
  }

  async countEmbeddings(): Promise<number> {
    if (this.vectorProvider) {
      return this.vectorProvider.count();
    }
    const rows = await this.executeQuery(
      `MATCH (e:${this.tableName}) RETURN count(e) AS cnt`,
    );
    const countRow = rows[0];
    return Number(countRow?.cnt ?? countRow?.[0] ?? 0);
  }

  async getAllEmbeddingsForExactScan(): Promise<
    Array<{
      nodeId: string;
      chunkIndex: number;
      startLine: number;
      endLine: number;
      embedding: number[];
    }>
  > {
    const rows = await this.executeQuery(`
      MATCH (e:${this.tableName})
      RETURN e.nodeId AS nodeId, e.chunkIndex AS chunkIndex,
             e.startLine AS startLine, e.endLine AS endLine, e.embedding AS embedding
    `);
    return rows.map((row: any) => ({
      nodeId: row.nodeId ?? row[0],
      chunkIndex: row.chunkIndex ?? row[1] ?? 0,
      startLine: row.startLine ?? row[2] ?? 0,
      endLine: row.endLine ?? row[3] ?? 0,
      embedding: row.embedding ?? row[4] ?? [],
    }));
  }

  async queryNodesByIds(
    label: string,
    ids: string[],
  ): Promise<Array<Record<string, unknown>>> {
    const idList = ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(', ');
    const nodeQuery = `
      MATCH (n:\`${label}\`) WHERE n.id IN [${idList}]
      RETURN n.id AS id, n.name AS name, n.filePath AS filePath,
             n.startLine AS startLine, n.endLine AS endLine
    `;
    return await this.executeQuery(nodeQuery);
  }

  async isVectorIndexReady(): Promise<boolean> {
    if (this.vectorProvider) {
      return this.vectorProvider.health();
    }
    const vectorReady = await db.loadVectorExtension('embedding-repo');
    return vectorReady;
  }

  async initializeVectorIndex(): Promise<boolean> {
    if (this.vectorProvider) {
      try {
        await this.vectorProvider.init();
        return true;
      } catch {
        return false;
      }
    }
    const vectorReady = await db.loadVectorExtension('embedding-repo');
    if (!vectorReady) return false;
    try {
      await this.executeQuery(CREATE_VECTOR_INDEX_QUERY);
      return true;
    } catch (error) {
      if (isDev) {
        logger.warn({ error }, 'Vector index creation warning:');
      }
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    await this.vectorProvider?.dispose();
  }
}

export { EMBEDDING_TABLE_NAME, STALE_HASH_SENTINEL, EMBEDDING_DIMS, EMBEDDING_INDEX_NAME, CREATE_VECTOR_INDEX_QUERY };
export { loadVectorExtension } from '../lbug-adapter.js';
