import type { DBConfig } from '../storage/types.js';
import { DatabaseProviderRegistry } from '../storage/registry.js';
import type { GraphDatabaseProvider } from '../storage/GraphDatabaseProvider.js';
import { ConfigProviderRegistry } from './registry.js';

export function createDatabaseProvider(): GraphDatabaseProvider {
  const config = ConfigProviderRegistry.get().getConfig();
  const graphDb = config.stages?.graph_db;
  const dbConfig: DBConfig = {
    backend: (graphDb?.backend as DBConfig['backend']) ?? 'ladybug',
    connection: graphDb?.connection,
    queryLanguage: graphDb?.query_language as DBConfig['queryLanguage'],
    wrapperPath: graphDb?.wrapper_path,
  };
  return DatabaseProviderRegistry.create(dbConfig);
}
