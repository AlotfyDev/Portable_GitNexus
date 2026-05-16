import type { LoggerProvider } from './LoggerProvider.js';
import { PinoLoggerProvider } from './PinoLoggerProvider.js';

export class LoggerProviderRegistry {
  private static instance: LoggerProvider | null = null;

  static initialize(provider: LoggerProvider): void {
    LoggerProviderRegistry.instance = provider;
  }

  static get(): LoggerProvider {
    if (!LoggerProviderRegistry.instance) {
      LoggerProviderRegistry.instance = new PinoLoggerProvider();
    }
    return LoggerProviderRegistry.instance;
  }

  static reset(): void {
    LoggerProviderRegistry.instance = null;
  }

  static child(name: string): LoggerProvider {
    return LoggerProviderRegistry.get().child(name);
  }
}
