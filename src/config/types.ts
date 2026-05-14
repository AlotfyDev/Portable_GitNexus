export interface PortableConfig {
  /** Source code directory to analyze (default: current working directory) */
  source_path?: string;
  /** Output directory for .gitnexus/ knowledge graph (default: source_path/.gitnexus) */
  output_path?: string;

  db: {
    path: string;
    max_size_mb: number;
  };
  server: {
    host: string;
    port: number;
    cors_origins: string[];
  };
  web_ui: {
    dist_dir: string;
  };
  wasm: {
    dir: string;
    grammars: string[];
  };
  sidecar: {
    enabled: boolean;
    wrapper_path: string;
  };
  embeddings: {
    enabled: boolean;
    backend: string;
    model_id: string;
    onnxruntime_dir: string;
    model_dir: string;
  };
  logging: {
    level: string;
    file: string;
  };
  vector_store?: {
    enabled: 'auto' | boolean;
    backend: 'icm' | 'ladybug';
    icm?: {
      binary_path: string;
    };
  };

  /**
   * Per-stage dependency paths and backend selection.
   * Each field describes *what role* the dependency fills, not *which
   * implementation* — the backend value selects the concretion.
   * Paths are relative to the portable app directory.
   */
  stages?: {
    ingestion?: {
      /** Parser backend: 'tree-sitter-wasm' (default) | 'tree-sitter-native' | custom */
      parser?: string;
      /** Path to grammar WASM files (tree-sitter-wasm only) */
      wasm_dir?: string;
      /** Grammar languages to load */
      grammars?: string[];
    };
    graph_db?: {
      /** Graph database backend: 'ladybug' (default) | 'neo4j' | 'kuzu' | custom */
      backend?: string;
      /** Connection string or database path */
      connection?: string;
      /** Query language: 'cypher' (default) | 'sql' | custom */
      query_language?: string;
      /** Sidecar wrapper path (for backends that need a sidecar process) */
      wrapper_path?: string;
    };
    search?: {
      /** Search backend: 'fts' (default) | 'elasticsearch' | custom */
      backend?: string;
    };
    embeddings?: {
      /** Embedding backend: 'wasm' (default) | 'native' | 'http' | custom */
      backend?: string;
      /** Directory containing embedding model files */
      model_dir?: string;
      /** ONNX Runtime WASM directory (wasm backend only) */
      onnxruntime_dir?: string;
      /** Embedding model identifier */
      model_id?: string;
    };
  };
}
