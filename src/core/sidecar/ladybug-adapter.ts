import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SidecarManager } from './manager.js';
import { getPortability } from '../portability/index.js';

export class LadybugSidecar {
  constructor(private readonly manager: SidecarManager) {}

  static async create(dbPath?: string): Promise<LadybugSidecar> {
    const portable = getPortability();
    const sidecarDir = portable.isPortable
      ? join(portable.appDir, 'third-party', 'sidecar')
      : join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'third-party', 'sidecar');

    const scriptPath = join(sidecarDir, 'ladybug-wrapper.mjs');

    const manager = new SidecarManager({
      scriptPath,
      dbPath: dbPath || ':memory:',
      autoRestart: true,
      healthCheckIntervalMs: 30000,
      startupTimeoutMs: 15000,
    });

    await manager.start();
    return new LadybugSidecar(manager);
  }

  async query(cypher: string): Promise<{ columns: string[]; rows: unknown[][] }> {
    return this.manager.executeQuery(cypher);
  }

  async health(): Promise<boolean> {
    return this.manager.healthCheck();
  }

  getStatus() {
    return this.manager.getStatus();
  }

  async dispose(): Promise<void> {
    await this.manager.stop();
  }
}
