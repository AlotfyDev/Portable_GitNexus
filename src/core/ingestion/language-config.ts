import path from 'path';
import { StorageProviderRegistry } from '../storage/StorageProviderRegistry.js';
import type { ImportConfigs } from './import-resolvers/types.js';

import { isDev } from './utils/env.js';

import { LoggerProviderRegistry } from '../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();
// ============================================================================
// LANGUAGE-SPECIFIC CONFIG TYPES
// ============================================================================

/** TypeScript path alias config parsed from tsconfig.json */
export interface TsconfigPaths {
  /** Map of alias prefix -> target prefix (e.g., "@/" -> "src/") */
  aliases: Map<string, string>;
  /** Base URL for path resolution (relative to repo root) */
  baseUrl: string;
}

/** Go module config parsed from go.mod */
export interface GoModuleConfig {
  /** Module path (e.g., "github.com/user/repo") */
  modulePath: string;
}

/** PHP Composer PSR-4 autoload config */
export interface ComposerConfig {
  /** Map of namespace prefix -> directory (e.g., "App\\" -> "app/") */
  psr4: Map<string, string>;
  /** PSR-4 entries sorted by namespace length descending (longest match wins).
   *  Cached once at config load time to avoid re-sorting on every import. */
  psr4Sorted?: readonly [string, string][];
}

/** C# project config parsed from .csproj files */
export interface CSharpProjectConfig {
  /** Root namespace from <RootNamespace> or assembly name (default: project directory name) */
  rootNamespace: string;
  /** Directory containing the .csproj file */
  projectDir: string;
}

/** Swift Package Manager module config */
export interface SwiftPackageConfig {
  /** Map of target name -> source directory path (e.g., "SiuperModel" -> "Package/Sources/SiuperModel") */
  targets: Map<string, string>;
}

// ============================================================================
// LANGUAGE-SPECIFIC CONFIG LOADERS
// ============================================================================

/**
 * Parse tsconfig.json to extract path aliases.
 * Tries tsconfig.json, tsconfig.app.json, tsconfig.base.json in order.
 */
export async function loadTsconfigPaths(repoRoot: string): Promise<TsconfigPaths | null> {
  const candidates = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.base.json'];

  for (const filename of candidates) {
    try {
      const raw = await StorageProviderRegistry.get().readFile(repoRoot, filename);
      // Strip JSON comments (// and /* */ style) for robustness
      const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const tsconfig = JSON.parse(stripped);
      const compilerOptions = tsconfig.compilerOptions;
      if (!compilerOptions?.paths) continue;

      const baseUrl = compilerOptions.baseUrl || '.';
      const aliases = new Map<string, string>();

      for (const [pattern, targets] of Object.entries(compilerOptions.paths)) {
        if (!Array.isArray(targets) || targets.length === 0) continue;
        const target = targets[0] as string;

        // Convert glob patterns: "@/*" -> "@/", "src/*" -> "src/"
        const aliasPrefix = pattern.endsWith('/*') ? pattern.slice(0, -1) : pattern;
        const targetPrefix = target.endsWith('/*') ? target.slice(0, -1) : target;

        aliases.set(aliasPrefix, targetPrefix);
      }

      if (aliases.size > 0) {
        if (isDev) {
          logger.info(`📦 Loaded ${aliases.size} path aliases from ${filename}`);
        }
        return { aliases, baseUrl };
      }
    } catch {
      // File doesn't exist or isn't valid JSON - try next
    }
  }

  return null;
}

/**
 * Parse go.mod to extract module path.
 */
export async function loadGoModulePath(repoRoot: string): Promise<GoModuleConfig | null> {
  try {
    const content = await StorageProviderRegistry.get().readFile(repoRoot, 'go.mod');
    const match = content.match(/^module\s+(\S+)/m);
    if (match) {
      if (isDev) {
        logger.info(`📦 Loaded Go module path: ${match[1]}`);
      }
      return { modulePath: match[1] };
    }
  } catch {
    // No go.mod
  }
  return null;
}

/** Parse composer.json to extract PSR-4 autoload mappings (including autoload-dev). */
export async function loadComposerConfig(repoRoot: string): Promise<ComposerConfig | null> {
  try {
    const raw = await StorageProviderRegistry.get().readFile(repoRoot, 'composer.json');
    const composer = JSON.parse(raw);
    const psr4Raw = composer.autoload?.['psr-4'] ?? {};
    const psr4Dev = composer['autoload-dev']?.['psr-4'] ?? {};
    const merged = { ...psr4Raw, ...psr4Dev };

    const psr4 = new Map<string, string>();
    for (const [ns, dir] of Object.entries(merged)) {
      const nsNorm = (ns as string).replace(/\\+$/, '');
      const dirNorm = (dir as string).replace(/\\/g, '/').replace(/\/+$/, '');
      psr4.set(nsNorm, dirNorm);
    }

    if (isDev) {
      logger.info(`📦 Loaded ${psr4.size} PSR-4 mappings from composer.json`);
    }
    return { psr4 };
  } catch {
    return null;
  }
}

/**
 * Parse .csproj files to extract RootNamespace.
 * Scans the repo root for .csproj files and returns configs for each.
 */
export async function loadCSharpProjectConfig(repoRoot: string): Promise<CSharpProjectConfig[]> {
  const configs: CSharpProjectConfig[] = [];
  // BFS scan for .csproj files up to 5 levels deep, cap at 100 dirs to avoid runaway scanning
  const scanQueue: { dirRelative: string; depth: number }[] = [{ dirRelative: '.', depth: 0 }];
  const maxDepth = 5;
  const maxDirs = 100;
  let dirsScanned = 0;

  while (scanQueue.length > 0 && dirsScanned < maxDirs) {
    const { dirRelative, depth } = scanQueue.shift()!;
    dirsScanned++;
    try {
      const entries = await StorageProviderRegistry.get().readdir(repoRoot, dirRelative);
      for (const name of entries) {
        const entryRel = path.join(dirRelative, name).replace(/\\/g, '/');
        const s = await StorageProviderRegistry.get().stat(repoRoot, entryRel);
        if (s.isDirectory && depth < maxDepth) {
          // Skip common non-project directories
          if (
            name === 'node_modules' ||
            name === '.git' ||
            name === 'bin' ||
            name === 'obj'
          )
            continue;
          scanQueue.push({ dirRelative: entryRel, depth: depth + 1 });
        }
        if (s.isFile && name.endsWith('.csproj')) {
          try {
            const content = await StorageProviderRegistry.get().readFile(repoRoot, entryRel);
            const nsMatch = content.match(/<RootNamespace>\s*([^<]+)\s*<\/RootNamespace>/);
            const rootNamespace = nsMatch ? nsMatch[1].trim() : name.replace(/\.csproj$/, '');
            const projectDir = dirRelative.replace(/\\/g, '/');
            configs.push({ rootNamespace, projectDir });
            if (isDev) {
              logger.info(
                `📦 Loaded C# project: ${name} (namespace: ${rootNamespace}, dir: ${projectDir})`,
              );
            }
          } catch {
            // Can't read .csproj
          }
        }
      }
    } catch {
      // Can't read directory
    }
  }
  return configs;
}

export async function loadSwiftPackageConfig(repoRoot: string): Promise<SwiftPackageConfig | null> {
  // Swift imports are module-name based (e.g., `import SiuperModel`)
  // SPM convention: Sources/<TargetName>/ or Package/Sources/<TargetName>/
  // We scan for these directories to build a target map
  const targets = new Map<string, string>();

  const sourceDirs = ['Sources', 'Package/Sources', 'src'];
  for (const sourceDir of sourceDirs) {
    try {
      const entries = await StorageProviderRegistry.get().readdir(repoRoot, sourceDir);
      for (const name of entries) {
        const relPath = sourceDir + '/' + name;
        const s = await StorageProviderRegistry.get().stat(repoRoot, relPath);
        if (s.isDirectory) {
          targets.set(name, sourceDir + '/' + name);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  if (targets.size > 0) {
    if (isDev) {
      logger.info(`📦 Loaded ${targets.size} Swift package targets`);
    }
    return { targets };
  }
  return null;
}

// ============================================================================
// BUNDLED CONFIG LOADER
// ============================================================================

/** Load all language-specific configs once for an ingestion run. */
export async function loadImportConfigs(repoRoot: string): Promise<ImportConfigs> {
  return {
    tsconfigPaths: await loadTsconfigPaths(repoRoot),
    goModule: await loadGoModulePath(repoRoot),
    composerConfig: await loadComposerConfig(repoRoot),
    swiftPackageConfig: await loadSwiftPackageConfig(repoRoot),
    csharpConfigs: await loadCSharpProjectConfig(repoRoot),
  };
}
