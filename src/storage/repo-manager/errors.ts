import path from 'path';
import type { RegistryEntry } from './types.js';

export class RegistryNameCollisionError extends Error {
  readonly kind = 'RegistryNameCollisionError' as const;
  constructor(
    public readonly registryName: string,
    public readonly existingPath: string,
    public readonly requestedPath: string,
  ) {
    super(
      `Registry name "${registryName}" is already used by "${existingPath}".\n` +
        `Pass --name <alias> to register "${requestedPath}" under a different name, ` +
        `or --allow-duplicate-name to allow both paths under the same name (leaves -r <name> ambiguous for these two).`,
    );
    this.name = 'RegistryNameCollisionError';
  }
}

export class RegistryNotFoundError extends Error {
  readonly kind = 'RegistryNotFoundError' as const;
  constructor(
    public readonly target: string,
    public readonly availableNames: string[],
  ) {
    const hint =
      availableNames.length > 0
        ? ` Available: ${availableNames.join(', ')}.`
        : ' No repositories are currently registered.';
    super(`No registered repo matches "${target}".${hint}`);
    this.name = 'RegistryNotFoundError';
  }
}

export class RegistryAmbiguousTargetError extends Error {
  readonly kind = 'RegistryAmbiguousTargetError' as const;
  constructor(
    public readonly target: string,
    public readonly matches: RegistryEntry[],
  ) {
    const listing = matches.map((m) => `  - ${m.name}  (${m.path})`).join('\n');
    super(
      `Multiple registered repos match "${target}":\n${listing}\n` +
        `Pass the absolute path instead to disambiguate.`,
    );
    this.name = 'RegistryAmbiguousTargetError';
  }
}

export class AnalysisNotFinalizedError extends Error {
  readonly kind = 'AnalysisNotFinalizedError' as const;
  constructor(
    public readonly repoPath: string,
    public readonly storagePath: string,
    public readonly missing: 'meta' | 'registry-entry',
    public readonly registryPath: string,
  ) {
    const detail =
      missing === 'meta'
        ? `meta.json was not written to ${path.join(storagePath, 'meta.json')}`
        : `registry entry for ${repoPath} was not added to ${registryPath}`;
    super(
      `Analysis did not finalize for ${repoPath}: ${detail}. ` +
        `The on-disk index is incomplete and was not registered. ` +
        `Re-run "gitnexus analyze" — if the problem persists, inspect ` +
        `${storagePath} for a stale lbug.wal that signals an aborted write.`,
    );
    this.name = 'AnalysisNotFinalizedError';
  }
}

export class UnsafeStoragePathError extends Error {
  readonly kind = 'UnsafeStoragePathError' as const;
  constructor(
    public readonly entry: RegistryEntry,
    public readonly expectedStoragePath: string,
    public readonly actualStoragePath: string,
  ) {
    super(
      `Refusing to remove storage path for safety: expected ` +
        `"${expectedStoragePath}" under the repo's .gitnexus subfolder, ` +
        `but the registry entry has "${actualStoragePath}". ` +
        `This usually means the registry entry is corrupted or was ` +
        `hand-edited. Delete the entry manually from ~/.gitnexus/registry.json ` +
        `and re-run analyze.`,
    );
    this.name = 'UnsafeStoragePathError';
  }
}
