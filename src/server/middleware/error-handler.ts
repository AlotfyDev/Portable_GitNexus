import type { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../validation.js';
import { LoggerProviderRegistry } from '../../core/config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();

export const statusFromError = (err: any): number => {
  if (err instanceof BadRequestError) return err.status;
  const msg = String(err?.message ?? '');
  if (msg.includes('No indexed repositories') || msg.includes('not found')) return 404;
  if (msg.includes('Multiple repositories')) return 400;
  return 500;
};

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error({ err }, 'Unhandled error:');
  res.status(500).json({ error: 'Internal server error' });
};
