import type { Router } from 'express';
import type { LocalBackend } from '../mcp/local/local-backend.js';
import type { JobManager } from './analyze-job.js';
import type { ServerConfig } from './config.js';

export interface ServerDependencies {
  backend: LocalBackend;
  jobManager: JobManager;
  embedJobManager: JobManager;
  activeRepoPaths: Set<string>;
  config: ServerConfig;
}

export type RouteModule = (router: Router, deps: ServerDependencies) => void;

export { type GraphStreamRecord } from './streaming.js';
