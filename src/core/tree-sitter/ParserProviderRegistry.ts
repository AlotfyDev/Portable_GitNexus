import type { ParserProvider } from './ParserProvider.js';
import { TreeSitterParserProvider } from './TreeSitterParserProvider.js';

export class ParserProviderRegistry {
  private static instance: ParserProvider | null = null;

  static initialize(provider: ParserProvider): void {
    ParserProviderRegistry.instance = provider;
  }

  static get(): ParserProvider {
    if (!ParserProviderRegistry.instance) {
      ParserProviderRegistry.instance = new TreeSitterParserProvider();
    }
    return ParserProviderRegistry.instance;
  }

  static reset(): void {
    ParserProviderRegistry.instance = null;
  }
}
