/**
 * Embedder Module (Read-Only)
 *
 * Singleton factory for transformers.js embedding pipeline.
 * For MCP, we only need to compute query embeddings, not batch embed.
 */
import { pipeline, env } from '@huggingface/transformers';
import { isHttpMode, getHttpDimensions, httpEmbedQuery, } from '../../core/embeddings/http-client.js';
import { resolveEmbeddingConfig } from '../../core/embeddings/config.js';
import { applyHfEnvOverrides, isHfDownloadFailure, withHfDownloadRetry, } from '../../core/embeddings/hf-env.js';
import { silenceStdout, restoreStdout, realStderrWrite } from '../../core/lbug/pool-adapter.js';
import { logger } from '../../core/logger.js';
// Model config
const MODEL_ID = 'Snowflake/snowflake-arctic-embed-xs';
// Module-level state for singleton pattern
let embedderInstance = null;
let isInitializing = false;
let initPromise = null;
/**
 * Initialize the embedding model (lazy, on first search)
 */
export const initEmbedder = async () => {
    if (isHttpMode()) {
        throw new Error('initEmbedder() should not be called in HTTP mode.');
    }
    if (embedderInstance) {
        return embedderInstance;
    }
    if (isInitializing && initPromise) {
        return initPromise;
    }
    isInitializing = true;
    initPromise = (async () => {
        try {
            env.allowLocalModels = false;
            // Bridge user-controlled env vars to transformers.js: HF_HOME →
            // env.cacheDir, HF_ENDPOINT → env.remoteHost (#1205). Centralised in
            // applyHfEnvOverrides so this MCP entry point behaves identically to
            // the analyze pipeline embedder.
            applyHfEnvOverrides(env);
            const embeddingConfig = resolveEmbeddingConfig();
            logger.info('GitNexus: Loading embedding model (first search may take a moment)...');
            const devicesToTry = embeddingConfig.device === 'dml' || embeddingConfig.device === 'cuda'
                ? [embeddingConfig.device, 'cpu']
                : ['cpu'];
            for (const device of devicesToTry) {
                try {
                    // Silence stdout and stderr during model load — ONNX Runtime and transformers.js
                    // may write progress/init messages that corrupt MCP stdio protocol or produce
                    // noisy warnings (e.g. node assignment to execution providers).
                    // Use the centralized silenceStdout() to avoid conflicts with pool-adapter's
                    // own stdout patching (independent patching caused restore-order bugs).
                    silenceStdout();
                    process.stderr.write = (() => true);
                    try {
                        embedderInstance = await withHfDownloadRetry(() => pipeline('feature-extraction', MODEL_ID, {
                            device: device,
                            dtype: 'fp32',
                            session_options: {
                                logSeverityLevel: 3,
                                intraOpNumThreads: embeddingConfig.threads,
                                interOpNumThreads: 1,
                                executionMode: 'sequential',
                            },
                        }));
                    }
                    finally {
                        restoreStdout();
                        process.stderr.write = realStderrWrite;
                    }
                    logger.info({ device }, 'GitNexus: Embedding model loaded');
                    return embedderInstance;
                }
                catch (deviceError) {
                    // Network errors and circuit-open errors are not device-specific —
                    // they will fail the same way on every device. Rethrow immediately
                    // with actionable HF_ENDPOINT guidance rather than silently falling
                    // back to the next device.
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
                    if (device === 'cpu')
                        throw new Error('Failed to load embedding model');
                }
            }
            throw new Error('No suitable device found');
        }
        catch (error) {
            isInitializing = false;
            initPromise = null;
            embedderInstance = null;
            throw error;
        }
        finally {
            isInitializing = false;
        }
    })();
    return initPromise;
};
/**
 * Check if embedder is ready
 */
export const isEmbedderReady = () => isHttpMode() || embedderInstance !== null;
/**
 * Embed a query text for semantic search
 */
export const embedQuery = async (query) => {
    if (isHttpMode()) {
        return httpEmbedQuery(query);
    }
    const embedder = await initEmbedder();
    const result = await embedder(query, {
        pooling: 'mean',
        normalize: true,
    });
    return Array.from(result.data);
};
/**
 * Get embedding dimensions
 */
export const getEmbeddingDims = () => {
    return getHttpDimensions() ?? 384;
};
/**
 * Cleanup embedder
 */
export const disposeEmbedder = async () => {
    if (embedderInstance) {
        try {
            if ('dispose' in embedderInstance && typeof embedderInstance.dispose === 'function') {
                await embedderInstance.dispose();
            }
        }
        catch { }
        embedderInstance = null;
        initPromise = null;
    }
};
