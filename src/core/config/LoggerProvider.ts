export interface LoggerProvider {
  readonly name: string;

  info(msg: string): void;
  info(obj: unknown, msg?: string): void;

  warn(msg: string): void;
  warn(obj: unknown, msg?: string): void;

  error(msg: string): void;
  error(obj: unknown, msg?: string): void;

  debug(msg: string): void;
  debug(obj: unknown, msg?: string): void;

  fatal(msg: string): void;
  fatal(obj: unknown, msg?: string): void;

  child(name: string): LoggerProvider;

  flush(): void;
}
