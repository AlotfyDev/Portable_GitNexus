import type { CLIConfig } from './types.js';
export declare const loadCLIConfig: () => Promise<CLIConfig>;
export declare const saveCLIConfig: (config: CLIConfig) => Promise<void>;
