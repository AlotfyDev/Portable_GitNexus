/**
 * Embedder Module
 *
 * Handles model loading, caching, and both single and batch embedding operations.
 *
 * Uses snowflake-arctic-embed-xs by default (22M params, 384 dims, ~90MB)
 */
// Suppress ONNX Runtime native warnings (e.g. VerifyEachNodeIsAssignedToAnEp)
// Must be set BEFORE onnxruntime-node is imported by transformers.js
// Level 3 = Error only (skips Warning/Info)
if (!process.env.ORT_LOG_LEVEL) {
    process.env.ORT_LOG_LEVEL = '3';
}
import { pipeline, env, } from '@huggingface/transformers';
import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { DEV_APP_ROOT_URL } from '../../generated/constants.js';
import { DEFAULT_EMBEDDING_CONFIG } from './types.js';
import { isHttpMode, getHttpDimensions, httpEmbed } from './http-client.js';
import { resolveEmbeddingConfig } from './config.js';
import { applyHfEnvOverrides, isHfDownloadFailure, withHfDownloadRetry } from './hf-env.js';
import { selectProvider } from './provider.js';
import { getPortability } from '../portability/index.js';
import { logger } from '../logger.js';
/**
 * Check whether the onnxruntime-node package that @huggingface/transformers
 * will actually load at runtime ships the CUDA execution provider.
 *
 * Critical: we resolve from transformers' own module scope, NOT from ours.
 * npm may install two copies — a top-level 1.24.x (our dep) and a nested
 * 1.21.0 (transformers' pinned dep). The guard must inspect whichever copy
 * transformers.js will dlopen, otherwise the check is meaningless.
 */
function hasOrtCudaProvider() {
    if (getPortability().isPortable)
        return false;
    try {
        const require = createRequire(new URL(DEV_APP_ROOT_URL));
        const transformersDir = dirname(require.resolve('@huggingface/transformers/package.json'));
        const ortRequire = createRequire(join(transformersDir, 'package.json'));
        const ortPath = dirname(ortRequire.resolve('onnxruntime-node/package.json'));
        const arch = process.arch;
        const platform = process.platform;
        const binDir = join(ortPath, 'bin', 'napi-v6');
        switch (platform) {
            case 'linux': return existsSync(join(binDir, 'linux', arch, 'libonnxruntime_providers_cuda.so'));
            case 'win32': return existsSync(join(binDir, 'win32', arch, 'onnxruntime_providers_cuda.dll'));
            case 'darwin': return existsSync(join(binDir, 'darwin', arch, 'libonnxruntime_providers_cuda.dylib'));
            default: return false;
        }
    }
    catch {
        return false;
    }
}
/**
 * Check whether CUDA libraries are actually available on this system.
 * ONNX Runtime's native layer crashes (uncatchable) if we attempt CUDA
 * without the required shared libraries, so we probe first.
 *
 * Checks both:
 * 1. That system CUDA libraries (libcublasLt) are present
 * 2. That onnxruntime-node ships the CUDA execution provider binary
 *
 * Both conditions must be true — system CUDA libs alone are not enough
 * if onnxruntime-node is a CPU-only build (versions < 1.24.0).
 */
function isCudaAvailable() {
    if (!hasOrtCudaProvider())
        return false;
    try {
        const out = execFileSync('ldconfig', ['-p'], { timeout: 3000, encoding: 'utf-8' });
        if (out.includes('libcublasLt.so.12'))
            return true;
    }
    catch {
        // ldconfig not available (e.g. non-standard container)
    }
    for (const envVar of ['CUDA_PATH', 'LD_LIBRARY_PATH']) {
        const val = process.env[envVar];
        if (!val)
            continue;
        for (const dir of val.split(':').filter(Boolean)) {
            if (existsSync(join(dir, 'lib64', 'libcublasLt.so.12')) ||
                existsSync(join(dir, 'lib', 'libcublasLt.so.12')) ||
                existsSync(join(dir, 'libcublasLt.so.12')))
                return true;
        }
    }
    return false;
}
// ── Embedder Class ───────────────────────────────────────────────────────
export class Embedder {
    provider;
    config;
    onProgress;
    forceDevice;
    pipeline = null;
    initPromise = null;
    currentDevice = null;
    constructor(provider, config, onProgress, forceDevice) {
        this.provider = provider;
        this.config = config;
        this.onProgress = onProgress;
        this.forceDevice = forceDevice;
    }
    get isReady() {
        return this.pipeline !== null;
    }
    get device() {
        return this.currentDevice;
    }
    getPipeline() {
        if (!this.pipeline)
            throw new Error('Embedder not initialized. Call init() first.');
        return this.pipeline;
    }
    async init() {
        if (this.pipeline)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = (async () => {
            try {
                this.provider.configureEnv();
                applyHfEnvOverrides(env);
                const isDev = process.env.NODE_ENV === 'development';
                if (isDev) {
                    logger.info(`\u{1F9E0} Loading embedding model: ${this.config.modelId}`);
                }
                const progressCallback = this.onProgress
                    ? (data) => {
                        const progress = {
                            status: data.status === 'progress_total'
                                ? 'progress'
                                : (data.status ?? 'progress'),
                            file: 'file' in data ? data.file : undefined,
                            progress: 'progress' in data ? data.progress : undefined,
                            loaded: 'loaded' in data ? data.loaded : undefined,
                            total: 'total' in data ? data.total : undefined,
                        };
                        this.onProgress(progress);
                    }
                    : undefined;
                const devicesToTry = this.forceDevice
                    ? [this.forceDevice, 'cpu']
                    : this.provider.resolveDevices(this.config.device);
                for (const device of devicesToTry) {
                    try {
                        if (isDev && device === 'dml') {
                            logger.info('\u{1F527} Trying DirectML (DirectX12) GPU backend...');
                        }
                        else if (isDev && device === 'cuda') {
                            logger.info('\u{1F527} Trying CUDA GPU backend...');
                        }
                        else if (isDev && device === 'cpu') {
                            logger.info('\u{1F527} Using CPU backend...');
                        }
                        else if (isDev && device === 'wasm') {
                            logger.info('\u{1F527} Using WASM backend (slower)...');
                        }
                        this.pipeline = await withHfDownloadRetry(() => pipeline('feature-extraction', this.config.modelId, {
                            device,
                            dtype: 'fp32',
                            progress_callback: progressCallback,
                            session_options: {
                                logSeverityLevel: 3,
                                intraOpNumThreads: this.config.threads,
                                interOpNumThreads: 1,
                                executionMode: 'sequential',
                            },
                        }), {
                            onRetry: isDev
                                ? (attempt, max, err) => logger.warn({ attempt, max, err: err.message }, '\u26A0\uFE0F  Model download network error (attempt {attempt}/{max}), retrying\u2026')
                                : undefined,
                        });
                        this.currentDevice = device;
                        if (isDev) {
                            const label = device === 'dml'
                                ? 'GPU (DirectML/DirectX12)'
                                : device === 'cuda'
                                    ? 'GPU (CUDA)'
                                    : device.toUpperCase();
                            logger.info(`\u2705 Using ${label} backend`);
                            logger.info('\u2705 Embedding model loaded successfully');
                        }
                        return;
                    }
                    catch (deviceError) {
                        const errMsg = deviceError instanceof Error ? deviceError.message : String(deviceError);
                        if (isHfDownloadFailure(errMsg)) {
                            const endpointHint = process.env.HF_ENDPOINT
                                ? `The configured endpoint (${process.env.HF_ENDPOINT}) may be unreachable.`
                                : `huggingface.co may be unreachable from your network.\n` +
                                    `  Set HF_ENDPOINT to a mirror and retry:\n` +
                                    `    HF_ENDPOINT=https://hf-mirror.com npx gitnexus analyze --embeddings\n` +
                                    `    (Windows: set HF_ENDPOINT=https://hf-mirror.com && npx gitnexus analyze --embeddings)`;
                            throw new Error(`Failed to download embedding model: ${errMsg}\n  ${endpointHint}`);
                        }
                        if (isDev && (device === 'cuda' || device === 'dml')) {
                            const gpuType = device === 'dml' ? 'DirectML' : 'CUDA';
                            logger.info(`\u26A0\uFE0F  ${gpuType} not available, falling back to CPU...`);
                        }
                        if (device === devicesToTry[devicesToTry.length - 1]) {
                            throw deviceError;
                        }
                    }
                }
                throw new Error('No suitable device found for embedding model');
            }
            catch (error) {
                this.initPromise = null;
                this.pipeline = null;
                throw error;
            }
        })();
        return this.initPromise;
    }
    async embedText(text) {
        if (!this.pipeline)
            throw new Error('Embedder not initialized. Call init() first.');
        const result = await this.pipeline(text, { pooling: 'mean', normalize: true });
        return new Float32Array(result.data);
    }
    async embedBatch(texts) {
        if (texts.length === 0)
            return [];
        if (!this.pipeline)
            throw new Error('Embedder not initialized. Call init() first.');
        const result = await this.pipeline(texts, { pooling: 'mean', normalize: true });
        const data = result.data;
        const dimensions = this.config.dimensions;
        const embeddings = [];
        for (let i = 0; i < texts.length; i++) {
            const start = i * dimensions;
            const end = start + dimensions;
            embeddings.push(new Float32Array(Array.prototype.slice.call(data, start, end)));
        }
        return embeddings;
    }
    async dispose() {
        if (this.pipeline) {
            try {
                if ('dispose' in this.pipeline && typeof this.pipeline.dispose === 'function') {
                    await this.pipeline.dispose();
                }
            }
            catch { /* Ignore disposal errors */ }
            this.pipeline = null;
            this.initPromise = null;
            this.currentDevice = null;
        }
    }
}
// ── Module-Level Singleton (Backward-Compatible API) ─────────────────────
let defaultEmbedder = null;
/**
 * Get the current device being used for inference
 */
export const getCurrentDevice = () => defaultEmbedder?.device ?? null;
/**
 * Initialize the embedding model
 * Uses singleton pattern - only loads once, subsequent calls return cached instance
 *
 * @param onProgress - Optional callback for model download progress
 * @param config - Optional configuration override
 * @param forceDevice - Force a specific device
 * @returns Promise resolving to the embedder pipeline
 */
export const initEmbedder = async (onProgress, config = {}, forceDevice) => {
    if (isHttpMode()) {
        throw new Error('initEmbedder() should not be called in HTTP mode. ' +
            'Use embedText()/embedBatch() which handle HTTP transparently.');
    }
    if (!defaultEmbedder) {
        const provider = selectProvider();
        const finalConfig = provider.overrideConfig(resolveEmbeddingConfig(config));
        defaultEmbedder = new Embedder(provider, finalConfig, onProgress, forceDevice);
    }
    await defaultEmbedder.init();
    return defaultEmbedder.getPipeline();
};
/**
 * Check if the embedder is initialized and ready
 */
export const isEmbedderReady = () => {
    return isHttpMode() || (defaultEmbedder?.isReady ?? false);
};
/**
 * Get the effective embedding dimensions.
 * In HTTP mode, uses GITNEXUS_EMBEDDING_DIMS if set, otherwise the default.
 */
export const getEmbeddingDimensions = () => {
    if (isHttpMode()) {
        return getHttpDimensions() ?? DEFAULT_EMBEDDING_CONFIG.dimensions;
    }
    return DEFAULT_EMBEDDING_CONFIG.dimensions;
};
/**
 * Get the embedder instance (throws if not initialized)
 */
export const getEmbedder = () => {
    if (isHttpMode()) {
        throw new Error('getEmbedder() is not available in HTTP embedding mode. Use embedText()/embedBatch() instead.');
    }
    if (!defaultEmbedder) {
        throw new Error('Embedder not initialized. Call initEmbedder() first.');
    }
    return defaultEmbedder.getPipeline();
};
/**
 * Embed a single text string
 *
 * @param text - Text to embed
 * @returns Float32Array of embedding vector
 */
export const embedText = async (text) => {
    if (isHttpMode()) {
        const [vec] = await httpEmbed([text]);
        return vec;
    }
    if (!defaultEmbedder)
        throw new Error('Embedder not initialized. Call initEmbedder() first.');
    return defaultEmbedder.embedText(text);
};
/**
 * Embed multiple texts in a single batch
 * More efficient than calling embedText multiple times
 *
 * @param texts - Array of texts to embed
 * @returns Array of Float32Array embedding vectors
 */
export const embedBatch = async (texts) => {
    if (texts.length === 0)
        return [];
    if (isHttpMode())
        return httpEmbed(texts);
    if (!defaultEmbedder)
        throw new Error('Embedder not initialized. Call initEmbedder() first.');
    return defaultEmbedder.embedBatch(texts);
};
/**
 * Convert Float32Array to regular number array (for LadybugDB storage)
 */
export const embeddingToArray = (embedding) => {
    return Array.from(embedding);
};
/**
 * Cleanup the embedder (free memory)
 * Call this when done with embeddings
 */
export const disposeEmbedder = async () => {
    if (defaultEmbedder) {
        await defaultEmbedder.dispose();
        defaultEmbedder = null;
    }
};
