let sessionLock = Promise.resolve();
export const DB_LOCK_RETRY_ATTEMPTS = 3;
export const DB_LOCK_RETRY_DELAY_MS = 500;
export const isReadOnlyDbError = (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    return /read-only database/i.test(msg);
};
export const runWithSessionLock = async (operation) => {
    const previous = sessionLock;
    let release = null;
    sessionLock = new Promise((resolve) => {
        release = resolve;
    });
    await previous;
    try {
        return await operation();
    }
    finally {
        release?.();
    }
};
