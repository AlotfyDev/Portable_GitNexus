export declare const DB_LOCK_RETRY_ATTEMPTS = 3;
export declare const DB_LOCK_RETRY_DELAY_MS = 500;
export declare const isReadOnlyDbError: (err: unknown) => boolean;
export declare const runWithSessionLock: <T>(operation: () => Promise<T>) => Promise<T>;
