import type { Router } from 'express';
import type { LocalBackend } from '../mcp/local/local-backend.js';
import type { QueryPipeline } from '../core/query/QueryPipeline.js';
import type { JobManager } from './analyze-job.js';
import type { ServerConfig } from './config.js';

export interface ServerDependencies {
  backend: LocalBackend;
  queryPipeline: QueryPipeline;
  jobManager: JobManager;
  embedJobManager: JobManager;
  activeRepoPaths: Set<string>;
  config: ServerConfig;
}


