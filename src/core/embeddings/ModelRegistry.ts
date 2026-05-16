export interface ModelConfig {
  name: string;
  dimensions: number;
  path?: string;
  revision?: string;
  provider?: 'onnx' | 'http' | 'custom';
  hubModelId?: string;
}

export interface ModelRegistry {
  register(name: string, config: ModelConfig): void;
  get(name: string): ModelConfig;
  getDefault(): ModelConfig;
  list(): ModelConfig[];
}
