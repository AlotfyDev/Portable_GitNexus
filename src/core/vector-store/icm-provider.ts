import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { existsSync } from 'fs';
import { IVecDBProvider } from './provider.js';
import type { VectorStoreCapabilities, VectorRecord, SearchResult, SearchOptions } from './types.js';
import { LoggerProviderRegistry } from '../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();

interface IcmMemoryRecord {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

interface IcmSearchResult {
  id: string;
  score: number;
  text?: string;
  metadata?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  id: number;
  result?: T;
  error?: { message: string };
}

export class IcmVectorProvider implements IVecDBProvider {
  readonly name = 'icm';
  readonly capabilities: VectorStoreCapabilities = {
    similaritySearch: true,
    hybridSearch: true,
    metadata: true,
    maxDimensions: 768,
    persistent: true,
    windowsCompatible: true,
    requiresExternalServer: false,
  };

  private process: ChildProcess | null = null;
  private rl: ReturnType<typeof createInterface> | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private started = false;
  private binaryExists = false;

  constructor(private readonly icmPath: string) {}

  async init(): Promise<void> {
    this.binaryExists = existsSync(this.icmPath);
    if (!this.binaryExists) {
      logger.warn(`ICM binary not found at ${this.icmPath}; vector search unavailable`);
      return;
    }

    if (this.started) return;

    this.process = spawn(this.icmPath, ['serve'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.rl = createInterface({ input: this.process.stdout! });
    this.rl.on('line', (line: string) => {
      try {
        const response = JSON.parse(line.trim()) as JsonRpcResponse;
        if (response.id !== undefined && this.pendingRequests.has(response.id)) {
          const { resolve, reject } = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      } catch {
        /* malformed JSON — ignore */
      }
    });

    this.process.stderr!.on('data', (data: Buffer) => {
      logger.debug(`[ICM] ${data.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      this.started = false;
      for (const [, { reject }] of this.pendingRequests) {
        reject(new Error(`ICM process exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });

    this.process.on('error', (err) => {
      logger.error({ err }, 'ICM process error');
    });

    this.started = true;
  }

  async store(records: VectorRecord[]): Promise<void> {
    if (!this.started || !this.binaryExists) return;

    const existing = await this.count();
    const memories: IcmMemoryRecord[] = records.map((r) => ({
      id: r.id,
      text: JSON.stringify(r.metadata ?? {}),
      metadata: { ...r.metadata, _vector: r.vector },
    }));

    for (const mem of memories) {
      await this.rpc('icm_memory_store', {
        id: mem.id,
        text: mem.text,
        metadata: mem.metadata,
      });
    }

    if (existing === 0 && memories.length > 0) {
      await this.rpc('icm_memory_embed_all', {});
    }
  }

  async search(vector: number[], options: SearchOptions): Promise<SearchResult[]> {
    if (!this.started || !this.binaryExists) return [];

    const result = await this.rpc<IcmSearchResult[]>('icm_memory_recall', {
      query_embedding: vector,
      top_k: options.topK,
      min_score: options.minScore,
      filter: options.filter,
    });

    return (result ?? []).map((r) => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.started || !this.binaryExists) return;

    for (const id of ids) {
      try {
        await this.rpc('icm_memory_forget', { id });
      } catch {
        /* skip if not found */
      }
    }
  }

  async count(): Promise<number> {
    if (!this.started || !this.binaryExists) return 0;

    try {
      const stats = await this.rpc<{ total_memories: number }>('icm_memory_stats', {});
      return stats?.total_memories ?? 0;
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!this.started || !this.binaryExists) return;

    try {
      await this.rpc('icm_memory_forget', { topic: '*' });
    } catch {
      /* ignore */
    }
  }

  async health(): Promise<boolean> {
    if (!this.binaryExists) return false;
    if (!this.started) return false;

    try {
      await this.rpc('icm_memory_stats', {});
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    if (!this.started) return;

    try {
      await this.rpc('exit', {});
    } catch {
      /* ignore */
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.started = false;
  }

  private rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = ++this.requestId;
    const request = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + '\n');
    }) as Promise<T>;
  }
}
