import type { GraphDatabaseProvider } from './GraphDatabaseProvider.js';
import type { DBConfig } from './types.js';
import { LadybugGraphDatabaseProvider } from './LadybugGraphDatabaseProvider.js';

/**
 * DatabaseProviderRegistry
 *
 * Factory registry for GraphDatabaseProvider implementations.
 * Follows the same registration pattern used elsewhere in the codebase
 * (e.g., EmbeddingProvider, LanguageProvider registries).
 *
 * Register a backend name with a factory function, then create or retrieve
 * provider instances by name or by config.
 *
 * Usage:
 *   const provider = DatabaseProviderRegistry.create(config);
 *   await provider.initialize('my-repo', config);
 */
export class DatabaseProviderRegistry {
  private static providers = new Map<string, () => GraphDatabaseProvider>();

  /** Register a provider factory under a backend name */
  static register(name: string, factory: () => GraphDatabaseProvider): void {
    DatabaseProviderRegistry.providers.set(name, factory);
  }

  /** Get an existing provider instance by name */
  static getProvider(name: string): GraphDatabaseProvider {
    const factory = DatabaseProviderRegistry.providers.get(name);
    if (!factory) {
      const available = [...DatabaseProviderRegistry.providers.keys()].join(', ');
      throw new Error(
        `Unknown graph database backend "${name}". Available backends: ${available || 'none'}`,
      );
    }
    return factory();
  }

  /** Create a provider based on DBConfig.backend */
  static create(config: DBConfig): GraphDatabaseProvider {
    const backend = config.backend ?? 'ladybug';
    return DatabaseProviderRegistry.getProvider(backend);
  }
}

// Register default backends
DatabaseProviderRegistry.register('ladybug', () => new LadybugGraphDatabaseProvider());
