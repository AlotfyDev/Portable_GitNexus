import { IVecDBProvider } from './provider.js';
import type { VectorStoreCapabilities, VectorRecord, SearchResult, SearchOptions } from './types.js';
import { EMBEDDING_TABLE_NAME, EMBEDDING_INDEX_NAME, CREATE_VECTOR_INDEX_QUERY, STALE_HASH_SENTINEL } from '../lbug/schema.js';
import { DatabaseProviderRegistry } from '../storage/registry.js';

const db = DatabaseProviderRegistry.getProvider('ladybug');

export class LadybugVectorProvider implements IVecDBProvider {
  readonly name = 'ladybug-vector';
  readonly capabilities: VectorStoreCapabilities = {
    similaritySearch: true,
    hybridSearch: false,
    metadata: true,
    maxDimensions: 384,
    persistent: true,
    windowsCompatible: false,
    requiresExternalServer: false,
  };

  constructor(
    private readonly executeQuery: (cypher: string) => Promise<any[]>,
    private readonly executeBatch: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>,
    private readonly tableName: string = EMBEDDING_TABLE_NAME,
    private readonly indexName: string = EMBEDDING_INDEX_NAME,
  ) {}

  async init(): Promise<void> {
    await this.ensureVectorIndex();
  }

  async store(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    const cypher = `CREATE (e:${this.tableName} {id: $id, nodeId: $nodeId, chunkIndex: $chunkIndex, startLine: $startLine, endLine: $endLine, embedding: $embedding, contentHash: $contentHash})`;
    const paramsList = records.map((r) => ({
      id: r.id,
      nodeId: (r.metadata?.nodeId as string) ?? r.id,
      chunkIndex: (r.metadata?.chunkIndex as number) ?? 0,
      startLine: (r.metadata?.startLine as number) ?? 0,
      endLine: (r.metadata?.endLine as number) ?? 0,
      embedding: r.vector,
      contentHash: (r.metadata?.contentHash as string) ?? STALE_HASH_SENTINEL,
    }));
    await this.executeBatch(cypher, paramsList);
  }

  async search(vector: number[], options: SearchOptions): Promise<SearchResult[]> {
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
    return rows.map((row: any) => ({
      id: row.nodeId ?? row[0],
      score: row.distance ?? row[4],
      metadata: {
        chunkIndex: row.chunkIndex ?? row[1] ?? 0,
        startLine: row.startLine ?? row[2] ?? 0,
        endLine: row.endLine ?? row[3] ?? 0,
      },
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const cypher = `MATCH (e:${this.tableName} {nodeId: $nodeId}) DELETE e`;
    await this.executeBatch(cypher, ids.map((id) => ({ nodeId: id })));
  }

  async count(): Promise<number> {
    const rows = await this.executeQuery(`MATCH (e:${this.tableName}) RETURN count(e) AS cnt`);
    return Number(rows[0]?.cnt ?? rows[0]?.[0] ?? 0);
  }

  async clear(): Promise<void> {
    await this.executeQuery(`MATCH (e:${this.tableName}) DELETE e`);
  }

  async health(): Promise<boolean> {
    try {
      const rows = await this.executeQuery('RETURN 1');
      return rows !== undefined;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    // LadybugDB connection is managed externally
  }

  private async ensureVectorIndex(): Promise<void> {
    const vectorReady = await db.loadVectorExtension('ladybug-provider');
    if (!vectorReady) return;
    try {
      await this.executeQuery(CREATE_VECTOR_INDEX_QUERY);
    } catch {
      // index may already exist
    }
  }
}
