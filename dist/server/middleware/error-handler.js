import { BadRequestError } from '../validation.js';
import { logger } from '../../core/logger.js';
export const statusFromError = (err) => {
    if (err instanceof BadRequestError)
        return err.status;
    const msg = String(err?.message ?? '');
    if (msg.includes('No indexed repositories') || msg.includes('not found'))
        return 404;
    if (msg.includes('Multiple repositories'))
        return 400;
    return 500;
};
export const globalErrorHandler = (err, _req, res, _next) => {
    logger.error({ err }, 'Unhandled error:');
    res.status(500).json({ error: 'Internal server error' });
};
