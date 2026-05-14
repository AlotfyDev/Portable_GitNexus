export {
  type EmbeddingRepository,
  LadybugEmbeddingRepository,
} from './embedding-repository.js';
export {
  EMBEDDING_TABLE_NAME,
  STALE_HASH_SENTINEL,
  EMBEDDING_DIMS,
  EMBEDDING_INDEX_NAME,
  CREATE_VECTOR_INDEX_QUERY,
  loadVectorExtension,
} from './embedding-repository.js';
export type { GraphNode, GraphRelationship, EmbeddingRecord } from './types.js';
