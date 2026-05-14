import { loadPortableConfig } from '../config/index.js';
export const DEFAULT_SERVER_CONFIG = {
    port: parseInt(process.env.PORT || '4747', 10),
    host: process.env.HOST || '127.0.0.1',
    bodyLimit: '10mb',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()),
    pnaHeaderValue: '?1',
    defaultTimeoutMs: 300_000,
    repoHoldTimeoutMs: 300_000,
    analyzeTimeoutMs: 1_800_000,
    embedTimeoutMs: 300_000,
    repoDeleteCooldownMs: 2_000,
    repoDeleteMaxPerMinute: 10,
    heartBeatIntervalMs: 15_000,
    webDistDir: '',
    wasmGrammars: [],
};
export function loadConfig(overrides) {
    const portable = loadPortableConfig();
    return {
        ...DEFAULT_SERVER_CONFIG,
        port: parseInt(process.env.PORT || String(portable.server.port), 10),
        host: process.env.HOST || portable.server.host,
        corsOrigins: portable.server.cors_origins,
        webDistDir: portable.web_ui.dist_dir,
        wasmGrammars: portable.wasm.grammars,
        ...overrides,
    };
}
