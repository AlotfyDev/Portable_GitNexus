import { loadPortableConfig } from '../../config/portable-config.js';
import type { PortableConfig } from '../../config/types.js';
import type { ConfigProvider } from './ConfigProvider.js';

export class PortableConfigProvider implements ConfigProvider {
  readonly name = 'portable-config';
  private config: PortableConfig | null = null;

  getConfig(): PortableConfig {
    if (!this.config) this.config = loadPortableConfig();
    return this.config;
  }

  get<T = unknown>(key: string, defaultValue?: T): T {
    const parts = key.split('.');
    let value: any = this.getConfig();
    for (const part of parts) {
      if (value == null || typeof value !== 'object') return defaultValue as T;
      value = (value as Record<string, any>)[part];
    }
    return (value ?? defaultValue) as T;
  }

  getStage(stage: string): Record<string, unknown> {
    return (this.getConfig().stages as any)?.[stage] ?? {};
  }

  reload(): void {
    this.config = null;
  }
}
