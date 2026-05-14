import type { Express } from 'express';
import express from 'express';
import cors from 'cors';
import type { ServerConfig } from '../config.js';
import { isAllowedOrigin } from './cors.js';

export function mountMiddleware(app: Express, config: ServerConfig): void {
  app.disable('x-powered-by');

  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      },
    }),
  );

  app.use(express.json({ limit: config.bodyLimit }));

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', config.pnaHeaderValue);
    next();
  });

  app.options('*', (_req, _res, next) => {
    next();
  });
}
