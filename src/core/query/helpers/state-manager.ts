import fs from 'fs/promises';
import path from 'path';
import { createDatabaseProvider } from '../../config/database-config.js';
import { listRegisteredRepos, cleanupOldKuzuFiles } from '../../../storage/repo-manager.js';
import { checkStalenessAsync, checkCwdMatch } from '../../../core/git-staleness.js';
import { LoggerProviderRegistry } from '../../../core/config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();
import { GroupService, type GroupToolPort } from '../../../core/group/service.js';
import type { CodebaseContext, RepoHandle } from './types.js';

const db = createDatabaseProvider();

export interface ToolHooks {
  impact: (repo: RepoHandle, params: any) => Promise<any>;
  query: (repo: RepoHandle, params: any) => Promise<any>;
  impactByUid: (repoId: string, uid: string, direction: string, opts: any) => Promise<any>;
  context: (repo: RepoHandle, params: any) => Promise<any>;
}

export class StateManager {
  repos = new Map<string, RepoHandle>();
  contextCache = new Map<string, CodebaseContext>();
  initializedRepos = new Set<string>();
  reinitPromises = new Map<string, Promise<void>>();
  lastStalenessCheck = new Map<string, number>();
  groupToolSvc: GroupService | null = null;
  warnedSiblingDrift = new Set<string>();
  warnedVectorUnsupported = false;

  getGroupService(hooks: ToolHooks): GroupService {
    if (!this.groupToolSvc) {
      const port: GroupToolPort = {
        resolveRepo: (p) => this.resolveRepo(p),
        impact: (r, p) => hooks.impact(r as RepoHandle, p),
        query: (r, p) => hooks.query(r as RepoHandle, p),
        impactByUid: (id, uid, d, o) => hooks.impactByUid(id, uid, d, o),
        context: (r, p) => hooks.context(r as RepoHandle, p),
      };
      this.groupToolSvc = new GroupService(port);
    }
    return this.groupToolSvc;
  }

  async dispose(): Promise<void> {
    await db.closeAll();
  }

  async init(): Promise<boolean> {
    await this.refreshRepos();
    return this.repos.size > 0;
  }

  async refreshRepos(): Promise<void> {
    const entries = await listRegisteredRepos({ validate: true });
    const freshIds = new Set<string>();

    for (const entry of entries) {
      const id = this.repoId(entry.name, entry.path);
      freshIds.add(id);

      const storagePath = entry.storagePath;
      const lbugPath = path.join(storagePath, 'lbug');

      const kuzu = await cleanupOldKuzuFiles(storagePath);
      if (kuzu.found && kuzu.needsReindex) {
        logger.error(
          `GitNexus: "${entry.name}" has a stale KuzuDB index. Run: gitnexus analyze ${entry.path}`,
        );
      }

      const handle: RepoHandle = {
        id, name: entry.name, repoPath: entry.path,
        storagePath, lbugPath, indexedAt: entry.indexedAt,
        lastCommit: entry.lastCommit, remoteUrl: entry.remoteUrl, stats: entry.stats,
      };
      this.repos.set(id, handle);

      const s = entry.stats || {};
      this.contextCache.set(id, {
        projectName: entry.name,
        stats: {
          fileCount: s.files || 0, functionCount: s.nodes || 0,
          communityCount: s.communities || 0, processCount: s.processes || 0,
        },
      });
    }

    for (const id of this.repos.keys()) {
      if (!freshIds.has(id)) {
        this.repos.delete(id);
        this.contextCache.delete(id);
        this.initializedRepos.delete(id);
      }
    }
  }

  private repoId(name: string, repoPath: string): string {
    const base = name.toLowerCase();
    for (const [id, handle] of this.repos) {
      if (id === base && handle.repoPath !== path.resolve(repoPath)) {
        const hash = Buffer.from(repoPath).toString('base64url').slice(0, 6);
        return `${base}-${hash}`;
      }
    }
    return base;
  }

  async resolveRepo(repoParam?: string): Promise<RepoHandle> {
    const result = this.resolveRepoFromCache(repoParam);
    if (result) {
      this.maybeWarnSiblingDrift(result).catch(() => {});
      return result;
    }

    await this.refreshRepos();
    const retried = this.resolveRepoFromCache(repoParam);
    if (retried) {
      this.maybeWarnSiblingDrift(retried).catch(() => {});
      return retried;
    }

    if (this.repos.size === 0) {
      throw new Error('No indexed repositories. Run: gitnexus analyze');
    }

    const nameCounts = new Map<string, number>();
    for (const h of this.repos.values()) {
      const key = h.name.toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    const labels = [...this.repos.values()].map((h) =>
      (nameCounts.get(h.name.toLowerCase()) ?? 0) > 1 ? `${h.name} (${h.repoPath})` : h.name,
    );
    if (repoParam) {
      throw new Error(`Repository "${repoParam}" not found. Available: ${labels.join(', ')}`);
    }
    throw new Error(
      `Multiple repositories indexed. Specify which one with the "repo" parameter. Available: ${labels.join(', ')}`,
    );
  }

  private resolveRepoFromCache(repoParam?: string): RepoHandle | null {
    if (this.repos.size === 0) return null;
    if (repoParam) {
      const paramLower = repoParam.toLowerCase();
      if (this.repos.has(paramLower)) return this.repos.get(paramLower)!;
      for (const handle of this.repos.values()) {
        if (handle.name.toLowerCase() === paramLower) return handle;
      }
      const resolved = path.resolve(repoParam);
      for (const handle of this.repos.values()) {
        if (handle.repoPath === resolved) return handle;
      }
      for (const handle of this.repos.values()) {
        if (handle.name.toLowerCase().includes(paramLower)) return handle;
      }
      return null;
    }
    if (this.repos.size === 1) return this.repos.values().next().value!;
    return null;
  }

  async ensureInitialized(repoId: string): Promise<void> {
    const pending = this.reinitPromises.get(repoId);
    if (pending) return pending;

    const handle = this.repos.get(repoId);
    if (!handle) throw new Error(`Unknown repo: ${repoId}`);

    if (this.initializedRepos.has(repoId) && db.isReady(repoId)) {
      const now = Date.now();
      const lastCheck = this.lastStalenessCheck.get(repoId) ?? 0;
      if (now - lastCheck < 5000) return;

      this.lastStalenessCheck.set(repoId, now);
      try {
        const metaPath = path.join(handle.storagePath, 'meta.json');
        const metaRaw = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw);
        if (meta.indexedAt && meta.indexedAt !== handle.indexedAt) {
          const reinit = (async () => {
            try {
              await db.close(repoId);
              this.initializedRepos.delete(repoId);
              handle.indexedAt = meta.indexedAt;
              await db.initialize(repoId, { connection: handle.lbugPath });
              this.initializedRepos.add(repoId);
            } finally {
              this.reinitPromises.delete(repoId);
            }
          })();
          this.reinitPromises.set(repoId, reinit);
          return reinit;
        }
        return;
      } catch {
        return;
      }
    }

    try {
      await db.initialize(repoId, { connection: handle.lbugPath });
      this.initializedRepos.add(repoId);
    } catch (err: any) {
      this.initializedRepos.delete(repoId);
      throw err;
    }
  }

  getContext(repoId?: string): CodebaseContext | null {
    if (repoId && this.contextCache.has(repoId)) {
      return this.contextCache.get(repoId)!;
    }
    if (this.repos.size === 1) {
      return this.contextCache.values().next().value ?? null;
    }
    return null;
  }

  async listRepos(): Promise<
    Array<{
      name: string; path: string; indexedAt: string; lastCommit: string;
      remoteUrl?: string; stats?: any;
      staleness?: { commitsBehind: number; hint?: string };
      siblings?: Array<{ name: string; path: string; lastCommit: string }>;
    }>
  > {
    await this.refreshRepos();
    const handles = [...this.repos.values()];

    const isWin = process.platform === 'win32';
    const norm = (p: string) => (isWin ? path.resolve(p).toLowerCase() : path.resolve(p));
    const byRemote = new Map<string, RepoHandle[]>();
    for (const h of handles) {
      if (!h.remoteUrl) continue;
      const list = byRemote.get(h.remoteUrl) ?? [];
      list.push(h);
      byRemote.set(h.remoteUrl, list);
    }

    const stalenessResults = await Promise.all(
      handles.map((h) => checkStalenessAsync(h.repoPath, h.lastCommit)),
    );

    return handles.map((h, i) => {
      const stale = stalenessResults[i];
      const selfNorm = norm(h.repoPath);
      const siblings = h.remoteUrl
        ? (byRemote.get(h.remoteUrl) ?? []).filter((e) => norm(e.repoPath) !== selfNorm)
        : [];
      return {
        name: h.name, path: h.repoPath, indexedAt: h.indexedAt,
        lastCommit: h.lastCommit, remoteUrl: h.remoteUrl, stats: h.stats,
        staleness: stale.isStale
          ? { commitsBehind: stale.commitsBehind, hint: stale.hint }
          : undefined,
        siblings: siblings.length > 0
          ? siblings.map((s) => ({ name: s.name, path: s.repoPath, lastCommit: s.lastCommit }))
          : undefined,
      };
    });
  }

  private async maybeWarnSiblingDrift(handle: RepoHandle): Promise<void> {
    if (!handle.remoteUrl) return;
    let cwd: string;
    try { cwd = process.cwd(); } catch { return; }
    const cacheKey = `${handle.id}|${cwd}`;
    if (this.warnedSiblingDrift.has(cacheKey)) return;

    const match = await checkCwdMatch(cwd);
    if (
      match.match !== 'sibling-by-remote' || !match.entry || !match.cwdGitRoot ||
      match.entry.path !== handle.repoPath || !match.hint
    ) {
      this.warnedSiblingDrift.add(cacheKey);
      return;
    }
    this.warnedSiblingDrift.add(cacheKey);
    logger.error(`GitNexus: ${match.hint}`);
  }

  async disconnect(): Promise<void> {
    await db.closeAll();
    this.repos.clear();
    this.contextCache.clear();
    this.initializedRepos.clear();
  }
}
