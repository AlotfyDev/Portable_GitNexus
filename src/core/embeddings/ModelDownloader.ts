import type { ModelConfig } from './ModelRegistry.js';

export interface ModelDownloader {
  ensureModel(config: ModelConfig): Promise<string>;
  getModelPath(name: string): string;
  isDownloaded(name: string): boolean;
}
