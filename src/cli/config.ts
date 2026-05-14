import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { loadPortableConfig } from '../config/portable-config.js';
import { getPortability } from '../core/portability/index.js';

function getConfigPath(): string {
  const portable = getPortability();
  const configDir = portable.isPortable
    ? join(portable.appDir, 'third-party', 'config')
    : join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'third-party', 'config');
  return join(configDir, 'portable-config.yaml');
}

function deepGet(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function deepSet(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

export const configCommand = async (action?: string, key?: string, value?: string) => {
  const configPath = getConfigPath();

  switch (action) {
    case 'view':
    case undefined: {
      const config = loadPortableConfig();
      console.log(yaml.dump(config as unknown as Record<string, unknown>, { indent: 2, noRefs: true, sortKeys: false }));
      break;
    }

    case 'get': {
      if (!key) {
        console.error('Usage: gitnexus config get <key> (e.g. "source_path" or "server.port")');
        process.exitCode = 1;
        return;
      }
      const config = loadPortableConfig() as unknown as Record<string, unknown>;
      const pathParts = key.split('.');
      const val = deepGet(config, pathParts);
      if (val === undefined) {
        console.error(`Key "${key}" not found in config`);
        process.exitCode = 1;
        return;
      }
      if (typeof val === 'object') {
        console.log(yaml.dump(val, { indent: 2, noRefs: true, sortKeys: false }));
      } else {
        console.log(String(val));
      }
      break;
    }

    case 'set': {
      if (!key || value === undefined) {
        console.error('Usage: gitnexus config set <key> <value>');
        process.exitCode = 1;
        return;
      }

      if (!existsSync(configPath)) {
        console.error('Config file not found at: ' + configPath);
        process.exitCode = 1;
        return;
      }

      const raw = yaml.load(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      const pathParts = key.split('.');
      let parsedValue: unknown = value;

      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);

      deepSet(raw, pathParts, parsedValue);
      writeFileSync(configPath, yaml.dump(raw, { indent: 2, noRefs: true, sortKeys: false, lineWidth: 120 }), 'utf-8');
      console.log(`Set ${key} = ${String(parsedValue)}`);
      break;
    }

    default: {
      console.error('Usage: gitnexus config [view|get|set]');
      console.error('  gitnexus config view              Show current configuration');
      console.error('  gitnexus config get <key>         Get a config value (e.g. "source_path" or "server.port")');
      console.error('  gitnexus config set <key> <val>   Set a config value (e.g. "source_path" "./my-project")');
      process.exitCode = 1;
    }
  }
};
