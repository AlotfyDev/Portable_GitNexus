import { logger, createLogger, flushLoggerSync } from '../logger.js';
import type { LoggerProvider } from './LoggerProvider.js';

export class PinoLoggerProvider implements LoggerProvider {
  readonly name = 'pino';
  private inner: typeof logger;

  constructor() {
    this.inner = logger;
  }

  info(msg: string): void;
  info(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void {
    if (typeof obj === 'string' && msg === undefined) {
      (this.inner.info as Function)(obj);
    } else {
      (this.inner.info as Function)(obj, msg);
    }
  }

  warn(msg: string): void;
  warn(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void {
    if (typeof obj === 'string' && msg === undefined) {
      (this.inner.warn as Function)(obj);
    } else {
      (this.inner.warn as Function)(obj, msg);
    }
  }

  error(msg: string): void;
  error(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void {
    if (typeof obj === 'string' && msg === undefined) {
      (this.inner.error as Function)(obj);
    } else {
      (this.inner.error as Function)(obj, msg);
    }
  }

  debug(msg: string): void;
  debug(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void {
    if (typeof obj === 'string' && msg === undefined) {
      (this.inner.debug as Function)(obj);
    } else {
      (this.inner.debug as Function)(obj, msg);
    }
  }

  fatal(msg: string): void;
  fatal(obj: unknown, msg?: string): void;
  fatal(obj: unknown, msg?: string): void {
    if (typeof obj === 'string' && msg === undefined) {
      (this.inner.fatal as Function)(obj);
    } else {
      (this.inner.fatal as Function)(obj, msg);
    }
  }

  child(name: string): LoggerProvider {
    const childLogger = createLogger(name);
    const childProvider = new PinoLoggerProvider();
    childProvider.inner = childLogger as any;
    return childProvider;
  }

  flush(): void {
    flushLoggerSync();
  }
}
