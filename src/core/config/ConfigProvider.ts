import type { PortableConfig } from '../../config/types.js';

export interface ConfigProvider {
  readonly name: string;

  /** Get full config object */
  getConfig(): PortableConfig;

  /** Get a specific config value by dot-notation key (e.g. 'embeddings.model_id') */
  get<T = unknown>(key: string, defaultValue?: T): T;

  /** Get stage-specific config */
  getStage(stage: string): Record<string, unknown>;

  /** Reload config from source */
  reload(): void;

  /** Optional change listener for dynamic config */
  onChange?(callback: (config: PortableConfig) => void): () => void;
}
