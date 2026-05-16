import { pipeline, env } from '@huggingface/transformers';
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { ModelConfig } from './ModelRegistry.js';
import type { ModelDownloader } from './ModelDownloader.js';
import { applyHfEnvOverrides, withHfDownloadRetry } from './hf-env.js';

export class HuggingFaceModelDownloader implements ModelDownloader {
  private modelPaths = new Map<string, string>();

  async ensureModel(config: ModelConfig): Promise<string> {
    const cached = this.modelPaths.get(config.name);
    if (cached) return cached;

    const existingPath = this.findModelInCache(config);
    if (existingPath) {
      this.modelPaths.set(config.name, existingPath);
      return existingPath;
    }

    applyHfEnvOverrides(env);
    const pipe = await withHfDownloadRetry(() =>
      pipeline('feature-extraction', config.name, {
        device: 'cpu',
        dtype: 'fp32',
      }),
    );

    if (typeof (pipe as any).dispose === 'function') {
      await (pipe as any).dispose();
    }

    const path = this.findModelInCache(config);
    if (path) {
      this.modelPaths.set(config.name, path);
      return path;
    }

    throw new Error(
      `Model "${config.name}" download completed but files not found in HuggingFace cache`,
    );
  }

  getModelPath(name: string): string {
    const path = this.modelPaths.get(name);
    if (!path) throw new Error(`Model "${name}" not downloaded. Call ensureModel() first.`);
    return path;
  }

  isDownloaded(name: string): boolean {
    return this.modelPaths.has(name);
  }

  private findModelInCache(config: ModelConfig): string | null {
    const cacheDir = process.env.HF_HOME ?? join(homedir(), '.cache', 'huggingface');
    const hubDir = join(cacheDir, 'hub');
    const modelDirName = `models--${config.name.replace(/\//g, '--')}`;
    const snapshotsDir = join(hubDir, modelDirName, 'snapshots');

    if (!existsSync(snapshotsDir)) return null;

    const snapshots = readdirSync(snapshotsDir);
    if (snapshots.length === 0) return null;

    const snapshot = config.revision
      ? snapshots.find((s) => s.startsWith(config.revision)) ?? snapshots[0]
      : snapshots[0];

    return join(snapshotsDir, snapshot);
  }
}
