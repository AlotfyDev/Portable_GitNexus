import express from 'express';
import cors from 'cors';
import { isAllowedOrigin } from './cors.js';
export function mountMiddleware(app, config) {
    app.disable('x-powered-by');
    app.set('trust proxy', 'loopback, linklocal, uniquelocal');
    app.use(cors({
        origin: (origin, callback) => {
            callback(null, isAllowedOrigin(origin));
        },
    }));
    app.use(express.json({ limit: config.bodyLimit }));
    app.use((_req, res, next) => {
        res.setHeader('Access-Control-Allow-Private-Network', config.pnaHeaderValue);
        next();
    });
    app.options('*', (_req, _res, next) => {
        next();
    });
}
