export interface JsonRpcRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  id: number;
  result?: T;
  error?: { message: string };
}

export type SidecarState = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface SidecarOptions {
  scriptPath: string;
  dbPath?: string;
  args?: string[];
  env?: Record<string, string>;
  autoRestart?: boolean;
  healthCheckIntervalMs?: number;
  startupTimeoutMs?: number;
}

export interface SidecarStatus {
  state: SidecarState;
  pid: number | null;
  uptimeMs: number;
  lastHealthCheck: Date | null;
  restartCount: number;
}
