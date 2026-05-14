import { Router } from 'express';
import type { ServerDependencies } from '../types.js';
import { getVersion } from '../../core/environment.js';

export function mountHealth(router: Router, deps: ServerDependencies): void {
  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/api/heartbeat', (_req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(':ok\n\n');

    const interval = setInterval(() => res.write(':ping\n\n'), 15_000);

    _req.on('close', () => clearInterval(interval));
  });

  router.get('/api/info', (_req, res) => {
    const execPath = process.env.npm_execpath ?? '';
    const argv0 = process.argv[1] ?? '';
    let launchContext: 'npx' | 'global' | 'local';
    if (
      execPath.includes('npx') ||
      argv0.includes('_npx') ||
      process.env.npm_config_prefix?.includes('_npx')
    ) {
      launchContext = 'npx';
    } else if (argv0.includes('node_modules')) {
      launchContext = 'local';
    } else {
      launchContext = 'global';
    }
    res.json({ version: getVersion(), launchContext, nodeVersion: process.version });
  });
}
