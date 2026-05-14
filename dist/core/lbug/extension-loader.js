import { spawn } from 'child_process';
import { fileURLToPath } from 'node:url';
import { LBUG_MAX_DB_SIZE } from './lbug-config.js';
import { logger } from '../logger.js';
import { getPortability } from '../portability/index.js';
const DEFAULT_EXTENSION_INSTALL_TIMEOUT_MS = 15_000;
const EXTENSION_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const alreadyAvailable = (message) => message.includes('already loaded') ||
    message.includes('already installed') ||
    message.includes('already exists');
const resolvePolicyFromEnv = () => {
    const raw = process.env.GITNEXUS_LBUG_EXTENSION_INSTALL;
    if (raw === 'load-only' || raw === 'never' || raw === 'auto')
        return raw;
    return 'auto';
};
export const getExtensionInstallTimeoutMs = () => {
    const raw = process.env.GITNEXUS_LBUG_EXTENSION_INSTALL_TIMEOUT_MS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXTENSION_INSTALL_TIMEOUT_MS;
};
export const getExtensionInstallChildProcessArgs = (extensionName, maxDbSize = LBUG_MAX_DB_SIZE) => {
    if (!getPortability().hasNativeAddons)
        return [];
    const childScript = new URL('../../../scripts/install-duckdb-extension.mjs', import.meta.url);
    return [fileURLToPath(childScript), extensionName, String(maxDbSize)];
};
/**
 * Run `INSTALL <extension>` in a short-lived child Node process so the parent
 * event loop is never blocked by DuckDB's synchronous network call.
 *
 * The child opens its own scratch LadybugDB, executes the install, and exits.
 * If the child exceeds `timeoutMs` the parent kills it with SIGKILL and
 * resolves with `timedOut: true`.
 */
export const installDuckDbExtensionOutOfProcess = async (extensionName, timeoutMs = getExtensionInstallTimeoutMs()) => {
    if (!EXTENSION_NAME_PATTERN.test(extensionName)) {
        throw new Error(`Invalid DuckDB extension name: ${extensionName}`);
    }
    return await new Promise((resolve) => {
        const child = spawn(process.execPath, getExtensionInstallChildProcessArgs(extensionName), {
            env: {
                ...process.env,
                GITNEXUS_LBUG_EXTENSION_NAME: extensionName,
            },
            stdio: ['ignore', 'ignore', 'pipe'],
            windowsHide: true,
        });
        let stderr = '';
        child.stderr?.setEncoding('utf8');
        child.stderr?.on('data', (chunk) => {
            stderr = (stderr + chunk).slice(-4000);
        });
        let settled = false;
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            child.kill('SIGKILL');
            resolve({
                success: false,
                timedOut: true,
                message: `INSTALL ${extensionName} timed out after ${timeoutMs}ms`,
            });
        }, timeoutMs);
        child.on('error', (err) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve({ success: false, timedOut: false, message: err.message });
        });
        child.on('exit', (code, signal) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve({
                success: code === 0,
                timedOut: false,
                message: code === 0
                    ? `INSTALL ${extensionName} completed`
                    : `INSTALL ${extensionName} failed with ${signal ?? `exit code ${code}`}${stderr ? `: ${stderr.trim()}` : ''}`,
            });
        });
    });
};
/**
 * Centralized lifecycle manager for optional LadybugDB extensions.
 *
 * Always tries `LOAD EXTENSION <name>` first — it is per-connection,
 * idempotent, and never touches the network. If `LOAD` fails and the active
 * policy permits, the manager runs a single bounded out-of-process `INSTALL`
 * attempt per process and retries `LOAD`. Capability outcomes are cached so
 * unavailable extensions degrade search features without ever blocking
 * subsequent analyze or query calls.
 *
 * Policy precedence (most specific wins):
 *   per-call `opts.policy` → constructor `options.policy` → env → `auto`
 */
export class ExtensionManager {
    options;
    capabilities = new Map();
    installAttempted = new Map();
    warnedKeys = new Set();
    constructor(options = {}) {
        this.options = options;
    }
    /** Reset cached capability and install state. Test-only. */
    reset() {
        this.capabilities.clear();
        this.installAttempted.clear();
        this.warnedKeys.clear();
    }
    /** Snapshot of currently-known optional extension capabilities. */
    getCapabilities() {
        return Array.from(this.capabilities.values());
    }
    /**
     * Ensure an optional extension is loaded on the supplied connection.
     *
     * Returns `true` when the extension is usable on `query`, `false` when it
     * is unavailable. Never throws on install failure — analyze and query
     * paths are expected to degrade gracefully.
     */
    async ensure(query, name, label, opts = {}) {
        if (!EXTENSION_NAME_PATTERN.test(name)) {
            throw new Error(`Invalid DuckDB extension name: ${name}`);
        }
        const policy = opts.policy ?? this.options.policy ?? resolvePolicyFromEnv();
        const timeoutMs = opts.installTimeoutMs ?? this.options.installTimeoutMs ?? getExtensionInstallTimeoutMs();
        const warn = this.options.warn ?? ((msg) => logger.warn(msg));
        if (policy === 'never') {
            this.markUnavailable(name, label, 'extension install policy is "never"', warn);
            return false;
        }
        if (await this.tryLoad(query, name)) {
            this.markLoaded(name);
            return true;
        }
        if (policy === 'load-only') {
            this.markUnavailable(name, label, 'load-only policy: extension not pre-installed', warn);
            return false;
        }
        let install = this.installAttempted.get(name);
        if (!install) {
            const installFn = this.options.installExtension ?? installDuckDbExtensionOutOfProcess;
            install = await installFn(name, timeoutMs);
            this.installAttempted.set(name, install);
        }
        if (!install.success) {
            this.markUnavailable(name, label, install.message, warn);
            return false;
        }
        if (await this.tryLoad(query, name)) {
            this.markLoaded(name);
            return true;
        }
        this.markUnavailable(name, label, `LOAD ${name} failed after successful INSTALL`, warn);
        return false;
    }
    async tryLoad(query, name) {
        try {
            await query(`LOAD EXTENSION ${name}`);
            return true;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return alreadyAvailable(msg);
        }
    }
    markLoaded(name) {
        this.capabilities.set(name, { name, loaded: true });
    }
    markUnavailable(name, label, reason, warn) {
        this.capabilities.set(name, { name, loaded: false, reason });
        const key = `${name}:${reason}`;
        if (this.warnedKeys.has(key))
            return;
        this.warnedKeys.add(key);
        warn(`GitNexus: ${label} extension unavailable; continuing without ${label} features. ${reason}`);
    }
}
/** Process-wide singleton shared by core and pool adapters. */
export const extensionManager = new ExtensionManager();
/** Snapshot of which optional DuckDB extensions are loaded in this process. */
export const getExtensionCapabilities = () => extensionManager.getCapabilities();
/** Test-only: clear the singleton's cached capability and install state. */
export const resetExtensionState = () => extensionManager.reset();
