import type { VectorStoreCapabilities, VectorRecord, SearchResult, SearchOptions, VectorStoreStats } from './types.js';

/**
 * IVecDBProvider
 *
 * General-purpose vector database provider interface.
 * Not coupled to graph nodes, embedding pipelines, or any specific storage backend.
 */
export interface IVecDBProvider {
  readonly name: string;
  readonly capabilities: VectorStoreCapabilities;

  /** Initialize the provider (connect, create tables, etc.) */
  init(): Promise<void>;

  /** Store one or more vectors */
  store(records: VectorRecord[]): Promise<void>;

  /** Search for similar vectors */
  search(vector: number[], options: SearchOptions): Promise<SearchResult[]>;

  /** Delete vectors by ID */
  delete(ids: string[]): Promise<void>;

  /** Get total vector count */
  count(): Promise<number>;

  /** Clear all vectors */
  clear(): Promise<void>;

  /** Health check */
  health(): Promise<boolean>;

  /** Cleanup / disconnect */
  dispose(): Promise<void>;
}
