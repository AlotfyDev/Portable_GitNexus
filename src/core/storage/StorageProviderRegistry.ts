import type { StorageProvider } from './StorageProvider.js';
import { FileSystemStorageProvider } from './FileSystemStorageProvider.js';

export class StorageProviderRegistry {
  private static instance: StorageProvider | null = null;

  static initialize(provider: StorageProvider): void {
    StorageProviderRegistry.instance = provider;
  }

  static get(): StorageProvider {
    if (!StorageProviderRegistry.instance) {
      StorageProviderRegistry.instance = new FileSystemStorageProvider();
    }
    return StorageProviderRegistry.instance;
  }

  static reset(): void {
    StorageProviderRegistry.instance = null;
  }
}

StorageProviderRegistry.initialize(new FileSystemStorageProvider());
