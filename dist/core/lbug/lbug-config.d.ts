import type lbug from '@ladybugdb/core';
/**
 * Shared configuration for `@ladybugdb/core` `Database` construction.
 *
 * Two values changed meaningfully in `@ladybugdb/core` 0.16.0 and need to be
 * pinned explicitly by every caller, otherwise GitNexus regresses:
 *
 * 1. `maxDBSize` defaults to `0`, which the native runtime interprets as
 *    "use the platform's full mmap address space" — typically 8 TB on
 *    64-bit Linux. Constrained environments (CI runners, containers, WSL)
 *    cannot reserve that much address space and crash with
 *    `Buffer manager exception: Mmap for size 8796093022208 failed.`
 *    See LadybugDB upstream JSDoc:
 *    > "introduced temporarily for now to get around with the default 8TB
 *    > mmap address space limit some environment".
 *
 * 2. `enableCompression` flipped its default from `false` (0.15.x) to
 *    `true` (0.16.0). Existing call sites that relied on the positional
 *    default must now pass `false` explicitly to preserve behaviour.
 *
 * Putting both in one shared module guarantees every `new lbug.Database(...)`
 * call site agrees on the same ceiling and behaviour.
 */
/**
 * Upper bound for any single GitNexus LadybugDB file (graph index, group
 * bridge, install scratch, test fixture). 16 GiB is intentionally generous
 * for real-world code graphs (the GitNexus self-index uses < 50 MiB) while
 * remaining far below any 64-bit OS mmap ceiling.
 *
 * Override with the `GITNEXUS_LBUG_MAX_DB_SIZE` environment variable when
 * indexing genuinely huge monorepos. Values are coerced to a positive
 * integer; anything invalid falls back to the default.
 */
export declare const LBUG_MAX_DB_SIZE: number;
export declare const WAL_RECOVERY_SUGGESTION = "WAL corruption detected. Run `gitnexus analyze` to rebuild the index.";
export declare function isWalCorruptionError(err: unknown): boolean;
type LbugModule = typeof lbug;
export interface LbugDatabaseOptions {
    readOnly?: boolean;
    throwOnWalReplayFailure?: boolean;
}
export interface LbugConnectionHandle {
    db: lbug.Database;
    conn: lbug.Connection;
}
/**
 * Return true when the error message indicates that a LadybugDB file lock
 * could not be acquired — either at construction time
 * (`new lbug.Database(...)` raises from `local_file_system.cpp`) or during
 * a query (another writer holds the exclusive lock).
 *
 * Lives here (not in `lbug-adapter.ts`) so both the construction-time
 * retry (`openWithLockRetry` in this file) and the query-time retry
 * (`withLbugDb` in `lbug-adapter.ts`) consult the same matcher. Callers
 * import directly from this module — no re-export to keep in sync.
 */
export declare const isDbBusyError: (err: unknown) => boolean;
export declare function createLbugDatabase(lbugModule: LbugModule, databasePath: string, options?: LbugDatabaseOptions): lbug.Database;
/**
 * Marker symbol attached to lock errors after `openWithLockRetry` exhausts
 * its budget. `withLbugDb`'s outer query-time retry consults this so it
 * does not re-retry a path that just spent up to ~1.5s in the open-time
 * loop — preventing 6s tail latencies (3× outer × 5× inner attempts).
 *
 * The symbol is internal to GitNexus; consumers should treat the underlying
 * error message as the user-visible signal.
 */
export declare const LBUG_OPEN_RETRY_EXHAUSTED: unique symbol;
export declare const isOpenRetryExhausted: (err: unknown) => boolean;
/** Exported only for direct unit testing — production callers use `openWithLockRetry`. */
export declare const _isTestFixturePathForTest: (dbPath: string) => boolean;
export declare function openLbugConnection(lbugModule: LbugModule, databasePath: string, options?: LbugDatabaseOptions): Promise<LbugConnectionHandle>;
export declare function closeLbugConnection(handle: LbugConnectionHandle): Promise<void>;
/**
 * Probe `dbPath` AND its `.wal` sidecar after `db.close()` so any
 * residual native file handle surfaces as EBUSY/EPERM/EACCES and the
 * bounded retry absorbs the release lag. Windows-only — Linux/macOS do
 * not exhibit this race.
 *
 * Both files matter. Empirically, on rapid open→close→reopen cycles the
 * main `dbPath` handle releases first; the `.wal` handle from the
 * previous Database lingers and the new Database's first write (CREATE
 * NODE TABLE during schema init) fails with "Could not set lock on
 * file". Probing both makes safeClose actually return when the kernel
 * is fully done with the path.
 *
 * Returns `true` when both probes succeeded (or skipped on non-lock
 * errors / missing files). Returns `false` when either probe exhausted
 * its budget with a lock code still in flight.
 *
 * Defensive shape:
 *   - Opens read+write (`'r+'`) so the probe actually surfaces exclusive
 *     locks held by the previous Database. A read-only probe (`'r'`) is
 *     insufficient — Windows will grant read access while the previous
 *     handle's exclusive write lock is still in flight, which lets
 *     `safeClose` return before the next CREATE NODE TABLE can lock the
 *     file.
 *   - `try/finally` around `handle.close()` guarantees no fd leak even
 *     if close itself throws.
 */
export declare const waitForWindowsHandleRelease: (dbPath: string) => Promise<boolean>;
export {};
