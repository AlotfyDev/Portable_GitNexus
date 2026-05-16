import type { RepoMeta, RegistryEntry } from '../../storage/repo-manager/types.js';
import type { StoragePaths, RegisterOptions } from './types.js';

/**
 * StorageProvider
 *
 * Abstract interface for filesystem-level storage operations — meta.json,
 * the global registry, storage paths, and finalization checks.
 *
 * This decouples ALL storage consumers (CLI commands, MCP tools, server
 * routes) from the concrete filesystem layout in src/storage/repo-manager/.
 * Every backend (local fs, cloud blob, etc.) implements this contract.
 *
 * Reference: docs/Architecture/01-LAYERS/03-Data-Storage-Layer.md §8
 */
export interface StorageProvider {
  // ── Repo Metadata ──────────────────────────────────────────────────────

  /** Load RepoMeta from a repo's storage path */
  loadMeta(repoPath: string): Promise<RepoMeta | null>;

  /** Save RepoMeta to a repo's storage path */
  saveMeta(repoPath: string, meta: RepoMeta): Promise<void>;

  /** Check whether a repo's storage path has a meta.json (index exists) */
  hasIndex(repoPath: string): Promise<boolean>;

  // ── Registry ───────────────────────────────────────────────────────────

  /** Read all entries from the global registry */
  readRegistry(): Promise<RegistryEntry[]>;

  /** Write entries to the global registry */
  writeRegistry(entries: RegistryEntry[]): Promise<void>;

  /** Register a repo in the global registry */
  registerRepo(repoPath: string, meta: RepoMeta, options?: RegisterOptions): Promise<string>;

  // ── Paths ──────────────────────────────────────────────────────────────

  /** Get the storage paths for a given repo */
  getStoragePaths(repoPath: string): StoragePaths;

  /** Get the global directory for GitNexus state */
  getGlobalDir(): string;

  // ── Finalization ───────────────────────────────────────────────────────

  /** Assert that a repo's analysis is finalized (meta + registry entry exist) */
  assertFinalized(repoPath: string): Promise<void>;

  // ── Git Integration ────────────────────────────────────────────────────

  /** Ensure .gitnexus is in .gitignore / info/exclude */
  ensureGitNexusIgnored(repoPath: string): Promise<void>;

  /** Get the remote origin URL for a repo */
  getRemoteUrl(repoPath: string): Promise<string | undefined>;

  /** Check whether a directory contains a .git entry */
  hasGitDir(repoPath: string): boolean;

  // ── File I/O ────────────────────────────────────────────────────

  /** Read a file's contents as UTF-8 string */
  readFile(repoPath: string, relativePath: string): Promise<string>;

  /** Get file or directory stats */
  stat(repoPath: string, relativePath: string): Promise<{ size: number; isDirectory: boolean; isFile: boolean }>;

  /** List directory entries */
  readdir(repoPath: string, relativePath: string): Promise<string[]>;

  /** Glob pattern matching within a repo */
  glob(repoPath: string, pattern: string, ignore?: string[]): Promise<string[]>;
}
