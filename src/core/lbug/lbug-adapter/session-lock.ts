let sessionLock: Promise<void> = Promise.resolve();

export const DB_LOCK_RETRY_ATTEMPTS = 3;
export const DB_LOCK_RETRY_DELAY_MS = 500;

export const isReadOnlyDbError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /read-only database/i.test(msg);
};

export const runWithSessionLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = sessionLock;
  let release: (() => void) | null = null;
  sessionLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await operation();
  } finally {
    release?.();
  }
};
