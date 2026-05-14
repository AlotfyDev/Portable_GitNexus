import { env } from '@huggingface/transformers';
import { existsSync } from 'fs';
import { basename } from 'path';
import { DEFAULT_EMBEDDING_CONFIG } from './types.js';
import { getPortability } from '../portability/index.js';
import { loadPortableConfig, resolveConfigPath } from '../../config/portable-config.js';
// ── Runtime Detection ────────────────────────────────────────────────────
// Distinguishes bun-compiled binary from Node.js during portable mode.
function isBunRuntime() {
    const name = basename(process.execPath);
    return name !== 'node' && name !== 'node.exe';
}
// ── WASM Portable Provider (bun binary) ──────────────────────────────────
// Uses onnxruntime-web WASM backend + local model files.
// Only viable in bun-compiled portable builds (no native .node addons).
class WasmPortableProvider {
    wasmDir;
    modelsDir;
    name = 'wasm-portable';
    modelId = 'intfloat/multilingual-e5-small';
    dimensions = 384;
    constructor(wasmDir, modelsDir) {
        this.wasmDir = wasmDir;
        this.modelsDir = modelsDir;
    }
    configureEnv() {
        try {
            env.backends.onnx.wasm = {
                wasmPaths: this.wasmDir,
                numThreads: 1,
            };
        }
        catch { /* WASM config not writable — onnxruntime-web handles defaults */ }
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.localModelPath = this.modelsDir;
        env.useFSCache = false;
    }
    resolveDevices(_configDevice) {
        return ['wasm'];
    }
    overrideConfig(config) {
        if (config.modelId === DEFAULT_EMBEDDING_CONFIG.modelId) {
            return { ...config, modelId: this.modelId, dimensions: this.dimensions };
        }
        return config;
    }
    supports(requirement) {
        switch (requirement) {
            case 'wasm-backend': return true;
            case 'native-ort': return false;
            case 'local-files-only': return true;
            case 'remote-models': return false;
        }
    }
}
// ── CPU Portable Provider (Node.js portable) ─────────────────────────────
// Uses onnxruntime-node CPU backend + local model files.
// Active when the portable build runs under Node.js (not bun-compiled).
class CpuPortableProvider {
    modelsDir;
    name = 'cpu-portable';
    modelId = 'intfloat/multilingual-e5-small';
    dimensions = 384;
    constructor(modelsDir) {
        this.modelsDir = modelsDir;
    }
    configureEnv() {
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.localModelPath = this.modelsDir;
        env.useFSCache = false;
    }
    resolveDevices(_configDevice) {
        return ['cpu'];
    }
    overrideConfig(config) {
        if (config.modelId === DEFAULT_EMBEDDING_CONFIG.modelId) {
            return { ...config, modelId: this.modelId, dimensions: this.dimensions };
        }
        return config;
    }
    supports(requirement) {
        switch (requirement) {
            case 'wasm-backend': return false;
            case 'native-ort': return true;
            case 'local-files-only': return true;
            case 'remote-models': return false;
        }
    }
}
// ── Native Node Provider (dev mode) ──────────────────────────────────────
// Uses onnxruntime-node backend. Tries local models first,
// falls back to HuggingFace Hub (free, but requires network).
class NativeNodeProvider {
    modelsDir;
    name = 'native-node';
    modelId = DEFAULT_EMBEDDING_CONFIG.modelId;
    dimensions = DEFAULT_EMBEDDING_CONFIG.dimensions;
    constructor(modelsDir) {
        this.modelsDir = modelsDir;
    }
    configureEnv() {
        if (existsSync(this.modelsDir)) {
            env.allowLocalModels = true;
            env.localModelPath = this.modelsDir;
        }
        else {
            env.allowLocalModels = false;
        }
    }
    resolveDevices(configDevice) {
        if (configDevice === 'cuda' || configDevice === 'dml') {
            return [configDevice, 'cpu'];
        }
        return ['cpu'];
    }
    overrideConfig(config) {
        return config;
    }
    supports(requirement) {
        switch (requirement) {
            case 'wasm-backend': return false;
            case 'native-ort': return true;
            case 'local-files-only': return true;
            case 'remote-models': return true;
        }
    }
}
// ── Provider Registry ────────────────────────────────────────────────────
function createProviders() {
    const config = loadPortableConfig();
    const portable = getPortability();
    const baseDir = portable.isPortable ? portable.appDir : process.cwd();
    return [
        new WasmPortableProvider(resolveConfigPath(config.embeddings.onnxruntime_dir, baseDir), resolveConfigPath(config.embeddings.model_dir, baseDir)),
        new CpuPortableProvider(resolveConfigPath(config.embeddings.model_dir, baseDir)),
        new NativeNodeProvider(resolveConfigPath(config.embeddings.model_dir, baseDir)),
    ];
}
const providers = createProviders();
export function selectProvider() {
    const override = process.env.GITNEXUS_EMBEDDING_PROVIDER;
    if (override) {
        const found = providers.find((p) => p.name === override);
        if (found)
            return found;
    }
    // Portable: bun binary → index 0 (wasm), Node.js → index 1 (cpu)
    if (getPortability().isPortable) {
        return isBunRuntime() ? providers[0] : providers[1];
    }
    return providers[2];
}
export function getAvailableProviders() {
    return providers.map((p) => p.name);
}
