import type { RepoMeta, RegistryEntry } from '../../storage/repo-manager/types.js';
import type { StoragePaths, RegisterOptions } from './types.js';
import type { StorageProvider } from './StorageProvider.js';

import { loadMeta, saveMeta, hasIndex } from '../../storage/repo-manager/meta.js';
import { getStoragePaths, getGlobalDir } from '../../storage/repo-manager/paths.js';
import { readRegistry, writeRegistry } from '../../storage/repo-manager/registry/index.js';
import { registerRepo } from '../../storage/repo-manager.js';
import { assertAnalysisFinalized } from '../../storage/repo-manager/finalization.js';
import { ensureGitNexusIgnored } from '../../storage/repo-manager/gitignore.js';
import { getRemoteUrl, hasGitDir } from '../../storage/git.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { glob as globFn } from 'glob';

/**
 * FileSystemStorageProvider
 *
 * Concrete implementation of StorageProvider that wraps the existing
 * filesystem-level functions in src/storage/repo-manager/.
 */
export class FileSystemStorageProvider implements StorageProvider {
  // ── Repo Metadata ──────────────────────────────────────────────────────

  async loadMeta(repoPath: string): Promise<RepoMeta | null> {
    return loadMeta(getStoragePaths(repoPath).storagePath);
  }

  async saveMeta(repoPath: string, meta: RepoMeta): Promise<void> {
    return saveMeta(getStoragePaths(repoPath).storagePath, meta);
  }

  async hasIndex(repoPath: string): Promise<boolean> {
    return hasIndex(repoPath);
  }

  // ── Registry ───────────────────────────────────────────────────────────

  async readRegistry(): Promise<RegistryEntry[]> {
    return readRegistry();
  }

  async writeRegistry(entries: RegistryEntry[]): Promise<void> {
    return writeRegistry(entries);
  }

  async registerRepo(repoPath: string, meta: RepoMeta, options?: RegisterOptions): Promise<string> {
    return registerRepo(repoPath, meta, options);
  }

  // ── Paths ──────────────────────────────────────────────────────────────

  getStoragePaths(repoPath: string): StoragePaths {
    return getStoragePaths(repoPath);
  }

  getGlobalDir(): string {
    return getGlobalDir();
  }

  // ── Finalization ───────────────────────────────────────────────────────

  async assertFinalized(repoPath: string): Promise<void> {
    return assertAnalysisFinalized(repoPath);
  }

  // ── Git Integration ────────────────────────────────────────────────────

  async ensureGitNexusIgnored(repoPath: string): Promise<void> {
    return ensureGitNexusIgnored(repoPath);
  }

  async getRemoteUrl(repoPath: string): Promise<string | undefined> {
    return getRemoteUrl(repoPath);
  }

  hasGitDir(repoPath: string): boolean {
    return hasGitDir(repoPath);
  }

  // ── File I/O ────────────────────────────────────────────────────

  async readFile(repoPath: string, relativePath: string): Promise<string> {
    return fs.readFile(path.join(repoPath, relativePath), 'utf-8');
  }

  async stat(repoPath: string, relativePath: string): Promise<{ size: number; isDirectory: boolean; isFile: boolean }> {
    const s = await fs.stat(path.join(repoPath, relativePath));
    return { size: s.size, isDirectory: s.isDirectory(), isFile: s.isFile() };
  }

  async readdir(repoPath: string, relativePath: string): Promise<string[]> {
    return fs.readdir(path.join(repoPath, relativePath));
  }

  async glob(repoPath: string, pattern: string, ignore?: string[]): Promise<string[]> {
    return globFn(pattern, { cwd: repoPath, nodir: true, dot: false, ignore });
  }
}
