import { logger } from '../../../core/logger.js';

export function logQueryError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error({ context, err: msg }, 'GitNexus query failed');
}

export function logQueryTiming(query: string, phases: Record<string, number>): void {
  const totalMs = phases.wall ?? Object.values(phases).reduce((a, b) => a + b, 0);
  const truncated = query.length > 80 ? `${query.slice(0, 80)}…` : query;
  logger.debug({ query: truncated, totalMs, phases }, 'GitNexus query timing');
}
