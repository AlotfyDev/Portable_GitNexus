import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';
import { getPortability } from '../core/portability/index.js';
import type { PortableConfig } from './types.js';

const DEFAULT_CONFIG: PortableConfig = {
  source_path: '.',
  output_path: './.gitnexus',
  db: { path: './data/lbug.lb', max_size_mb: 1024 },
  server: { host: '127.0.0.1', port: 4747, cors_origins: ['http://localhost:4747', 'http://127.0.0.1:4747'] },
  web_ui: { dist_dir: './third-party/web-ui' },
  wasm: { dir: './third-party/wasm', grammars: ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust', 'php', 'ruby', 'c-sharp'] },
  sidecar: { enabled: true, wrapper_path: './third-party/sidecar/ladybug-wrapper.mjs' },
  embeddings: { enabled: true, backend: 'wasm', model_id: 'intfloat/multilingual-e5-small', onnxruntime_dir: './third-party/wasm/onnxruntime', model_dir: './third-party/models' },
  logging: { level: 'info', file: './logs/gitnexus.log' },
  vector_store: { enabled: 'auto' as const, backend: 'ladybug', icm: { binary_path: './third-party/icm/icm.exe' } },
};

export function resolveConfigPath(relativePath: string, baseDir: string): string {
  return resolve(baseDir, relativePath);
}

export function loadPortableConfig(): PortableConfig {
  const portable = getPortability();
  const configDir = portable.isPortable
    ? join(portable.appDir, 'third-party', 'config')
    : join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'third-party', 'config');

  const configPath = join(configDir, 'portable-config.yaml');

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = load(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    return mergeConfig(DEFAULT_CONFIG, raw);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function mergeConfig(defaults: PortableConfig, overrides: Record<string, unknown>): PortableConfig {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const existing = (result as Record<string, unknown>)[key];
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        (result as Record<string, unknown>)[key] = {
          ...existing as Record<string, unknown>,
          ...value as Record<string, unknown>,
        };
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
