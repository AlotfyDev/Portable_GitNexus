export interface ServerConfig {
    readonly port: number;
    readonly host: string;
    readonly bodyLimit: string;
    readonly corsOrigins: string[];
    readonly pnaHeaderValue: string;
    readonly defaultTimeoutMs: number;
    readonly repoHoldTimeoutMs: number;
    readonly analyzeTimeoutMs: number;
    readonly embedTimeoutMs: number;
    readonly repoDeleteCooldownMs: number;
    readonly repoDeleteMaxPerMinute: number;
    readonly heartBeatIntervalMs: number;
    readonly webDistDir: string;
    readonly wasmGrammars: string[];
}
export declare const DEFAULT_SERVER_CONFIG: ServerConfig;
export declare function loadConfig(overrides?: Partial<ServerConfig>): ServerConfig;
