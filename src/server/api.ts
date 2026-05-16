import express, { Router } from 'express';
import { DEFAULT_SERVER_CONFIG } from './config.js';
import type { ServerDependencies } from './types.js';
import { mountMiddleware } from './middleware/index.js';
import { mountAllRoutes } from './routes/index.js';
import { registerGracefulShutdown } from './shutdown.js';
import { registerWebUI, resolveWebDistDir } from './web-ui.js';
import { mountMCPEndpoints } from './mcp-http.js';
import { LocalBackend } from '../mcp/local/local-backend.js';
import { QueryPipelineImpl } from '../core/query/QueryPipelineImpl.js';
import { createDatabaseProvider } from '../core/config/database-config.js';
import { JobManager } from './analyze-job.js';
import { globalErrorHandler } from './middleware/error-handler.js';

export { handleFileRequest } from './routes/file.js';
export { isAllowedOrigin } from './middleware/cors.js';
export { ClientDisconnectedError, isIgnorableGraphQueryError } from './streaming.js';

export async function createServer(port: number, host: string = '127.0.0.1') {
  const app = express();
  const config = { ...DEFAULT_SERVER_CONFIG, port, host };

  mountMiddleware(app, config);

  const backend = new LocalBackend();
  await backend.init();
  const cleanupMcp = mountMCPEndpoints(app, backend);

  const dbProvider = createDatabaseProvider();
  const queryPipeline = new QueryPipelineImpl(dbProvider, backend['ctx']);
  await queryPipeline.init();

  const jobManager = new JobManager();
  const embedJobManager = new JobManager();

  const deps: ServerDependencies = {
    backend,
    queryPipeline,
    jobManager,
    embedJobManager,
    activeRepoPaths: new Set<string>(),
    config,
  };

  const router = Router();
  mountAllRoutes(router, deps);
  app.use(router);

  const webDistDir = await resolveWebDistDir();
  registerWebUI(app, webDistDir);

  app.use(globalErrorHandler);

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const displayHost = host === '::' || host === '0.0.0.0' ? 'localhost' : host;
      console.log(`GitNexus server running on http://${displayHost}:${port}`);
      resolve();
    });
    server.on('error', (err) => reject(err));

    registerGracefulShutdown(server, {
      backend,
      jobManager,
      embedJobManager,
      cleanupMcp,
    });
  });
}
