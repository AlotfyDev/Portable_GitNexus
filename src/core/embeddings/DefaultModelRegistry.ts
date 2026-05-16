import type { ModelConfig, ModelRegistry } from './ModelRegistry.js';

export class DefaultModelRegistry implements ModelRegistry {
  private models = new Map<string, ModelConfig>();
  private defaultName: string;

  constructor(defaultName: string = 'e5-small-v2') {
    this.defaultName = defaultName;
    this.models.set('e5-small-v2', {
      name: 'e5-small-v2',
      dimensions: 384,
      provider: 'onnx',
      hubModelId: 'intfloat/multilingual-e5-small',
    });
  }

  register(name: string, config: ModelConfig): void {
    this.models.set(name, config);
  }

  get(name: string): ModelConfig {
    const config = this.models.get(name);
    if (!config) throw new Error(`Model "${name}" not found in registry`);
    return config;
  }

  getDefault(): ModelConfig {
    return this.get(this.defaultName);
  }

  list(): ModelConfig[] {
    return Array.from(this.models.values());
  }
}
