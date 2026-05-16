import type { ConfigProvider } from './ConfigProvider.js';
import { PortableConfigProvider } from './PortableConfigProvider.js';

export class ConfigProviderRegistry {
  private static instance: ConfigProvider | null = null;

  static initialize(provider: ConfigProvider): void {
    ConfigProviderRegistry.instance = provider;
  }

  static get(): ConfigProvider {
    if (!ConfigProviderRegistry.instance) {
      ConfigProviderRegistry.instance = new PortableConfigProvider();
    }
    return ConfigProviderRegistry.instance;
  }

  static reset(): void {
    ConfigProviderRegistry.instance = null;
  }
}
