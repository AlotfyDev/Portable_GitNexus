/**
 * LadybugDB connection pool (core). Used by MCP, sync, search, wiki, etc.
 *
 * LadybugDB Adapter (Connection Pool)
 *
 * Manages a pool of LadybugDB databases keyed by repoId, each with
 * multiple Connection objects for safe concurrent query execution.
 *
 * LadybugDB Connections are NOT thread-safe — a single Connection
 * segfaults if concurrent .query() calls hit it simultaneously.
 * This adapter provides a checkout/return connection pool so each
 * concurrent query gets its own Connection from the same Database.
 *
 * @see https://docs.ladybugdb.com/concurrency — multiple Connections
 * from the same Database is the officially supported concurrency pattern.
 */
import lbug from '@ladybugdb/core';
/**
 * Listeners notified when a pool entry is torn down (LRU eviction, idle
 * timeout, explicit close). Used by upper layers (e.g. the BM25 search
 * module) to invalidate per-repo caches that must not outlive the pool
 * entry that produced them.
 *
 * Listeners run synchronously inside `closeOne` after the pool entry has
 * been removed; throwing listeners are isolated so one bad listener does
 * not prevent others from firing or break teardown.
 */
type PoolCloseListener = (repoId: string) => void;
/**
 * Subscribe to pool-close events. Returns a disposer that removes the
 * listener (handy for tests).
 */
export declare function addPoolCloseListener(listener: PoolCloseListener): () => void;
export { realStdoutWrite, realStderrWrite, setActiveStdoutWrite } from '../../mcp/stdio-capture.js';
/**
 * Touch a repo to reset its idle timeout.
 * Call this during long-running operations to prevent the connection from being closed.
 */
export declare const touchRepo: (repoId: string) => void;
/**
 * Silence stdout by replacing process.stdout.write with a no-op.
 * Uses a reference counter so nested silence/restore pairs are safe.
 * Exported so other modules (e.g. embedder) use the same mechanism instead
 * of independently patching stdout, which causes restore-order conflicts.
 */
export declare function silenceStdout(): void;
export declare function restoreStdout(): void;
/**
 * Initialize (or reuse) a Database + connection pool for a specific repo.
 * Retries on lock errors (e.g., when `gitnexus analyze` is running).
 *
 * Concurrent calls for the same repoId are deduplicated — the second caller
 * awaits the first's in-progress init rather than starting a redundant one.
 */
export declare const initLbug: (repoId: string, dbPath: string) => Promise<void>;
/**
 * Initialize a pool entry from a pre-existing Database object.
 *
 * Used in tests to avoid the writable→close→read-only cycle that crashes
 * on macOS due to N-API destructor segfaults.  The pool adapter reuses
 * the core adapter's writable Database instead of opening a new read-only one.
 *
 * The Database is registered in the shared dbCache so closeOne() decrements
 * the refCount correctly.  If the Database is already cached (e.g. another
 * repoId already injected it), the existing entry is reused.
 */
export declare function initLbugWithDb(repoId: string, existingDb: lbug.Database, dbPath: string): Promise<void>;
export declare const executeQuery: (repoId: string, cypher: string) => Promise<any[]>;
/**
 * Execute a parameterized query on a specific repo's connection pool.
 * Uses prepare/execute pattern to prevent Cypher injection.
 */
export declare const executeParameterized: (repoId: string, cypher: string, params: Record<string, any>) => Promise<any[]>;
/**
 * Close one or all repo pools.
 * If repoId is provided, close only that repo's connections.
 * If omitted, close all repos.
 */
export declare const closeLbug: (repoId?: string) => Promise<void>;
/**
 * Check if a specific repo's pool is active
 */
export declare const isLbugReady: (repoId: string) => boolean;
/** Regex to detect write operations in user-supplied Cypher queries.
 * Note: CALL is NOT blocked — it's used for read-only FTS (CALL QUERY_FTS_INDEX)
 * and vector search (CALL QUERY_VECTOR_INDEX). The database is opened in
 * read-only mode as defense-in-depth against write procedures. */
export declare const CYPHER_WRITE_RE: RegExp;
/** Check if a Cypher query contains write operations */
export declare function isWriteQuery(query: string): boolean;
