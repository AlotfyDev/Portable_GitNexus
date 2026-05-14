import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
export class SidecarManager extends EventEmitter {
    options;
    process = null;
    state = 'stopped';
    startTime = 0;
    lastHealthCheck = null;
    restartCount = 0;
    requestId = 0;
    pendingRequests = new Map();
    healthTimer = null;
    rl = null;
    constructor(options) {
        super();
        this.options = options;
    }
    async start() {
        if (this.state !== 'stopped')
            throw new Error(`Cannot start sidecar in state: ${this.state}`);
        this.state = 'starting';
        const args = [...(this.options.args || [])];
        if (this.options.dbPath) {
            args.push('--db', this.options.dbPath);
        }
        this.process = spawn(process.execPath, [this.options.scriptPath, ...args], {
            env: { ...process.env, ...this.options.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.startTime = Date.now();
        this.state = 'running';
        this.rl = createInterface({ input: this.process.stdout });
        this.rl.on('line', (line) => {
            try {
                const response = JSON.parse(line.trim());
                if (response.id !== undefined && this.pendingRequests.has(response.id)) {
                    const { resolve, reject } = this.pendingRequests.get(response.id);
                    this.pendingRequests.delete(response.id);
                    if (response.error) {
                        reject(new Error(response.error.message));
                    }
                    else {
                        resolve(response.result);
                    }
                }
                else if (response.id === 0 && response.result?.ready) {
                    this.emit('ready', response.result);
                }
            }
            catch {
                /* malformed JSON — ignore */
            }
        });
        this.process.stderr.on('data', (data) => {
            this.emit('stderr', data.toString());
        });
        this.process.on('exit', (code) => {
            const crashed = this.state === 'running';
            this.state = 'stopped';
            this.emit('exit', code);
            for (const [id, { reject }] of this.pendingRequests) {
                reject(new Error(`Sidecar exited with code ${code} before responding to request ${id}`));
            }
            this.pendingRequests.clear();
            if (crashed && this.options.autoRestart) {
                this.restartCount++;
                this.start();
            }
        });
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Sidecar startup timed out'));
            }, this.options.startupTimeoutMs || 10000);
            this.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            this.process.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        if (this.options.healthCheckIntervalMs) {
            this.healthTimer = setInterval(() => this.healthCheck(), this.options.healthCheckIntervalMs);
        }
    }
    async stop() {
        if (this.state === 'stopped')
            return;
        this.state = 'stopping';
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = null;
        }
        try {
            await this.rpc('exit');
        }
        catch {
            /* ignore exit errors */
        }
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.state = 'stopped';
    }
    async restart() {
        await this.stop();
        this.restartCount = 0;
        await this.start();
    }
    async healthCheck() {
        try {
            await this.rpc('health');
            this.lastHealthCheck = new Date();
            this.emit('healthy');
            return true;
        }
        catch {
            this.emit('unhealthy');
            if (this.options.autoRestart) {
                this.restart();
            }
            return false;
        }
    }
    async rpc(method, params) {
        if (this.state !== 'running') {
            throw new Error(`Sidecar not running (state: ${this.state})`);
        }
        const id = ++this.requestId;
        const request = { id, method, params };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.process.stdin.write(JSON.stringify(request) + '\n');
        });
    }
    async executeQuery(cypher) {
        return this.rpc('query', { cypher });
    }
    async getSchema() {
        return this.rpc('schema');
    }
    getStatus() {
        return {
            state: this.state,
            pid: this.process?.pid || null,
            uptimeMs: this.state === 'running' ? Date.now() - this.startTime : 0,
            lastHealthCheck: this.lastHealthCheck,
            restartCount: this.restartCount,
        };
    }
}
