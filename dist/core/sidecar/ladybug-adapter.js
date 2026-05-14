import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SidecarManager } from './manager.js';
import { getPortability } from '../portability/index.js';
export class LadybugSidecar {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    static async create(dbPath) {
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
    async query(cypher) {
        return this.manager.executeQuery(cypher);
    }
    async health() {
        return this.manager.healthCheck();
    }
    getStatus() {
        return this.manager.getStatus();
    }
    async dispose() {
        await this.manager.stop();
    }
}
