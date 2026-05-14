import type { Server } from 'http';
import type { LocalBackend } from '../mcp/local/local-backend.js';
import { closeLbug } from '../core/lbug/lbug-adapter.js';
import { logger, flushLoggerSync } from '../core/logger.js';

export interface ShutdownOptions {
  backend?: LocalBackend;
  jobManager?: { dispose(): void | Promise<void> };
  embedJobManager?: { dispose(): void | Promise<void> };
  cleanupMcp?: () => Promise<void>;
  timeoutMs?: number;
}

export function registerGracefulShutdown(
  server: Server,
  options: ShutdownOptions,
): void {
  const shutdown = async () => {
    console.log('\nShutting down...');
    server.close();
    options.jobManager?.dispose();
    options.embedJobManager?.dispose();
    await options.cleanupMcp?.();
    await closeLbug();
    await options.backend?.disconnect();
    flushLoggerSync();
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  let shuttingDown = false;
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'GitNexus uncaughtException');
    flushLoggerSync();
    if (!shuttingDown) {
      shuttingDown = true;
      shutdown().catch(() => {});
    }
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error({ err }, 'GitNexus unhandledRejection');
  });
}
