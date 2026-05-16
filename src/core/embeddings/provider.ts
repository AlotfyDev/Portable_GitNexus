import { env } from '@huggingface/transformers';
import { existsSync } from 'fs';
import { basename } from 'path';
import { DEFAULT_EMBEDDING_CONFIG, type EmbeddingConfig } from './types.js';
import type { ModelRegistry } from './ModelRegistry.js';
import { DefaultModelRegistry } from './DefaultModelRegistry.js';
import { getPortability } from '../portability/index.js';
import { resolveConfigPath } from '../../config/portable-config.js';
import { ConfigProviderRegistry } from '../config/registry.js';

export type ProviderRequirement =
  | 'wasm-backend'
  | 'native-ort'
  | 'local-files-only'
  | 'remote-models';

export type Device = 'dml' | 'cuda' | 'cpu' | 'wasm';

export interface EmbeddingProvider {
  readonly name: string;
  readonly modelId: string;
  readonly dimensions: number;
  configureEnv(): void;
  resolveDevices(configDevice: EmbeddingConfig['device']): Device[];
  overrideConfig(config: EmbeddingConfig): EmbeddingConfig;
  supports(requirement: ProviderRequirement): boolean;
}

// ── Runtime Detection ────────────────────────────────────────────────────
// Distinguishes bun-compiled binary from Node.js during portable mode.

function isBunRuntime(): boolean {
  const name = basename(process.execPath);
  return name !== 'node' && name !== 'node.exe';
}

// ── WASM Portable Provider (bun binary) ──────────────────────────────────
// Uses onnxruntime-web WASM backend + local model files.
// Only viable in bun-compiled portable builds (no native .node addons).

class WasmPortableProvider implements EmbeddingProvider {
  readonly name = 'wasm-portable';

  get modelId(): string {
    return this.registry.getDefault().hubModelId ?? DEFAULT_EMBEDDING_CONFIG.modelId;
  }

  get dimensions(): number {
    return this.registry.getDefault().dimensions;
  }

  constructor(
    private readonly wasmDir: string,
    private readonly modelsDir: string,
    private readonly registry: ModelRegistry,
  ) {}

  configureEnv(): void {
    try {
      (env.backends.onnx as Record<string, unknown>).wasm = {
        wasmPaths: this.wasmDir,
        numThreads: 1,
      };
    } catch { /* WASM config not writable — onnxruntime-web handles defaults */ }
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = this.modelsDir;
    env.useFSCache = false;
  }

  resolveDevices(_configDevice: EmbeddingConfig['device']): Device[] {
    return ['wasm'];
  }

  overrideConfig(config: EmbeddingConfig): EmbeddingConfig {
    if (config.modelId === DEFAULT_EMBEDDING_CONFIG.modelId) {
      return { ...config, modelId: this.modelId, dimensions: this.dimensions };
    }
    return config;
  }

  supports(requirement: ProviderRequirement): boolean {
    switch (requirement) {
      case 'wasm-backend': return true;
      case 'native-ort': return false;
      case 'local-files-only': return true;
      case 'remote-models': return false;
    }
  }
}

// ── CPU Portable Provider (Node.js portable) ─────────────────────────────
// Uses onnxruntime-node CPU backend + local model files.
// Active when the portable build runs under Node.js (not bun-compiled).

class CpuPortableProvider implements EmbeddingProvider {
  readonly name = 'cpu-portable';

  get modelId(): string {
    return this.registry.getDefault().hubModelId ?? DEFAULT_EMBEDDING_CONFIG.modelId;
  }

  get dimensions(): number {
    return this.registry.getDefault().dimensions;
  }

  constructor(
    private readonly modelsDir: string,
    private readonly registry: ModelRegistry,
  ) {}

  configureEnv(): void {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = this.modelsDir;
    env.useFSCache = false;
  }

  resolveDevices(_configDevice: EmbeddingConfig['device']): Device[] {
    return ['cpu'];
  }

  overrideConfig(config: EmbeddingConfig): EmbeddingConfig {
    if (config.modelId === DEFAULT_EMBEDDING_CONFIG.modelId) {
      return { ...config, modelId: this.modelId, dimensions: this.dimensions };
    }
    return config;
  }

  supports(requirement: ProviderRequirement): boolean {
    switch (requirement) {
      case 'wasm-backend': return false;
      case 'native-ort': return true;
      case 'local-files-only': return true;
      case 'remote-models': return false;
    }
  }
}

// ── Native Node Provider (dev mode) ──────────────────────────────────────
// Uses onnxruntime-node backend. Tries local models first,
// falls back to HuggingFace Hub (free, but requires network).

class NativeNodeProvider implements EmbeddingProvider {
  readonly name = 'native-node';

  get modelId(): string {
    return this.registry.getDefault().hubModelId ?? DEFAULT_EMBEDDING_CONFIG.modelId;
  }

  get dimensions(): number {
    return this.registry.getDefault().dimensions;
  }

  constructor(
    private readonly modelsDir: string,
    private readonly registry: ModelRegistry,
  ) {}

  configureEnv(): void {
    if (existsSync(this.modelsDir)) {
      env.allowLocalModels = true;
      env.localModelPath = this.modelsDir;
    } else {
      env.allowLocalModels = false;
    }
  }

  resolveDevices(configDevice: EmbeddingConfig['device']): Device[] {
    if (configDevice === 'cuda' || configDevice === 'dml') {
      return [configDevice, 'cpu'];
    }
    return ['cpu'];
  }

  overrideConfig(config: EmbeddingConfig): EmbeddingConfig {
    return config;
  }

  supports(requirement: ProviderRequirement): boolean {
    switch (requirement) {
      case 'wasm-backend': return false;
      case 'native-ort': return true;
      case 'local-files-only': return true;
      case 'remote-models': return true;
    }
  }
}

// ── Provider Registry ────────────────────────────────────────────────────

function createProviders(registry: ModelRegistry): EmbeddingProvider[] {
  const config = ConfigProviderRegistry.get().getConfig();
  const portable = getPortability();
  const baseDir = portable.isPortable ? portable.appDir : process.cwd();

  return [
    new WasmPortableProvider(
      resolveConfigPath(config.embeddings.onnxruntime_dir, baseDir),
      resolveConfigPath(config.embeddings.model_dir, baseDir),
      registry,
    ),
    new CpuPortableProvider(
      resolveConfigPath(config.embeddings.model_dir, baseDir),
      registry,
    ),
    new NativeNodeProvider(
      resolveConfigPath(config.embeddings.model_dir, baseDir),
      registry,
    ),
  ];
}

function selectBestProvider(providersList: EmbeddingProvider[]): EmbeddingProvider {
  const override = process.env.GITNEXUS_EMBEDDING_PROVIDER;
  if (override) {
    const found = providersList.find((p) => p.name === override);
    if (found) return found;
  }
  // Portable: bun binary → index 0 (wasm), Node.js → index 1 (cpu)
  if (getPortability().isPortable) {
    return isBunRuntime() ? providersList[0] : providersList[1];
  }
  return providersList[2];
}

export function selectProvider(registry: ModelRegistry = new DefaultModelRegistry()): EmbeddingProvider {
  return selectBestProvider(createProviders(registry));
}


