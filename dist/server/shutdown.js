import { closeLbug } from '../core/lbug/lbug-adapter.js';
import { logger, flushLoggerSync } from '../core/logger.js';
export function registerGracefulShutdown(server, options) {
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
            shutdown().catch(() => { });
        }
    });
    process.on('unhandledRejection', (reason) => {
        const err = reason instanceof Error ? reason : new Error(String(reason));
        logger.error({ err }, 'GitNexus unhandledRejection');
    });
}
