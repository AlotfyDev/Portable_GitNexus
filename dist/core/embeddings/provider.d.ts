import { type EmbeddingConfig } from './types.js';
export type ProviderRequirement = 'wasm-backend' | 'native-ort' | 'local-files-only' | 'remote-models';
export type Device = 'dml' | 'cuda' | 'cpu' | 'wasm';
export interface EmbeddingProvider {
    readonly name: string;
    readonly modelId: string;
    readonly dimensions: number;
    configureEnv(): void;
    resolveDevices(configDevice: EmbeddingConfig['device']): Device[];
    overrideConfig(config: EmbeddingConfig): EmbeddingConfig;
    supports(requirement: ProviderRequirement): boolean;
}
export declare function selectProvider(): EmbeddingProvider;
export declare function getAvailableProviders(): string[];
