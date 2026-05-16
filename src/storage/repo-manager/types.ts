export interface RepoMeta {
  repoPath: string;
  lastCommit: string;
  indexedAt: string;
  remoteUrl?: string;
  stats?: {
    files?: number;
    nodes?: number;
    edges?: number;
    communities?: number;
    processes?: number;
    embeddings?: number;
  };

  /** Optional: declared capabilities from the PortabilityContract */
  capabilities?: string[];

  /** Artifact freshness chain for incremental analysis */
  artifacts?: Record<string, {
    fingerprint: string;
    timestamp: number;
    size?: number;
  }>;
}

export interface IndexedRepo {
  repoPath: string;
  storagePath: string;
  lbugPath: string;
  metaPath: string;
  meta: RepoMeta;
}

export interface RegistryEntry {
  name: string;
  path: string;
  storagePath: string;
  indexedAt: string;
  lastCommit: string;
  remoteUrl?: string;
  stats?: RepoMeta['stats'];
}

export interface RegisterRepoOptions {
  name?: string;
  allowDuplicateName?: boolean;
}

export interface CLIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  provider?: 'openai' | 'openrouter' | 'azure' | 'custom' | 'cursor';
  cursorModel?: string;
  apiVersion?: string;
  isReasoningModel?: boolean;
}

export interface CwdMatch {
  match: 'path' | 'sibling-by-remote' | 'none';
  entry?: RegistryEntry;
  cwdGitRoot?: string;
  cwdHead?: string;
  drift?: number;
  hint?: string;
}
