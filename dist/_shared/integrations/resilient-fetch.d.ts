/**
 * `resilientFetch` — fetch wrapped in retry + circuit breaker, with
 * GitHub-flavoured retry classification baked in (Retry-After parsing,
 * 401/403/404/422 treated as terminal client errors).
 *
 * Designed for the `gitnexus publish` GitHub `repository_dispatch`
 * call, but the classification rules apply to any GitHub REST endpoint.
 * Runtime-agnostic — no Node-only imports.
 */
import { CircuitBreaker, CircuitOpenError, type CircuitBreakerOptions } from './circuit-breaker.js';
import { type RetryOptions } from './retry.js';
export { CircuitOpenError };
export interface ResilientFetchOptions {
    /** Optional fetch implementation override. Defaults to `globalThis.fetch`. */
    fetchImpl?: typeof fetch;
    /**
     * Logical key for the breaker. Defaults to `<host><pathname>` of the
     * request URL — call sites targeting the same endpoint share breaker
     * state regardless of query-string differences.
     */
    breakerKey?: string;
    /** Per-call breaker override. Used for tests and one-off configuration. */
    breaker?: CircuitBreaker;
    /** Tuning knobs for the breaker registered under `breakerKey`. */
    breakerOptions?: CircuitBreakerOptions;
    /** Tuning knobs for the retry helper. */
    retry?: Partial<Pick<RetryOptions, 'maxAttempts' | 'baseDelayMs' | 'capDelayMs'>> & {
        sleep?: RetryOptions['sleep'];
        random?: RetryOptions['random'];
    };
    /** Clock override propagated into Retry-After HTTP-date math and breaker. */
    now?: () => number;
}
/** Cap on any single Retry-After wait — protects CLI from a buggy registry. */
export declare const RETRY_AFTER_CAP_MS = 30000;
/**
 * Parse a `Retry-After` header value into milliseconds.
 * Accepts either a delta-seconds integer (`"30"`) or an HTTP-date.
 * Returns null on parse failure or negative deltas.
 */
export declare function parseRetryAfter(value: string | null, now?: () => number): number | null;
/** Internal: outcome classification used by the resilientFetch loop. */
type Outcome = {
    kind: 'success';
    resp: Response;
} | {
    kind: 'terminal-client';
    resp: Response;
} | {
    kind: 'retryable-status';
    resp: Response;
    afterMs: number | undefined;
} | {
    kind: 'terminal-network';
    err: unknown;
} | {
    kind: 'retryable-network';
    err: unknown;
};
/** Exported for unit tests. */
export declare function classifyOutcome(result: {
    kind: 'error';
    err: unknown;
} | {
    kind: 'response';
    resp: Response;
}, now: () => number): Outcome;
/** Final error thrown when retries are exhausted on a 5xx / 429. */
export declare class ResilientFetchExhaustedError extends Error {
    readonly response: Response;
    readonly name = "ResilientFetchExhaustedError";
    constructor(response: Response);
}
/**
 * Wrap `fetch` with bounded retries and a per-process circuit breaker.
 *
 * Semantics:
 * - 5xx and 429 responses are retried; 429 honors `Retry-After` (capped).
 * - Network throws are retried unless they are `TimeoutError` DOMExceptions.
 * - Timeouts and 4xx (other than 429) are returned/thrown without retry
 *   AND without incrementing the breaker — they reflect caller config
 *   or local network state, not registry health.
 * - Each `fetch` call carries the caller-supplied `signal` (e.g. an
 *   `AbortSignal.timeout()`) — that timeout bounds each individual
 *   attempt, not the whole retry sequence.
 * - When the breaker is open, throws `CircuitOpenError` synchronously
 *   without invoking `fetch`.
 * - When retries are exhausted on a 5xx / 429, throws
 *   `ResilientFetchExhaustedError` carrying the last response.
 *
 * Cumulative wall-clock budget:
 *   maxAttempts × (per-attempt-timeout + capDelayMs)
 *   With defaults (3, 500ms base, 5000ms cap) and a typical 15s per-attempt
 *   timeout from the caller's signal, worst case is ~3 × (15s + 5s) = 60s.
 *   Callers that want a tighter total bound should reduce `maxAttempts` or
 *   wrap `resilientFetch` in their own outer `AbortSignal.timeout()`.
 */
export declare function resilientFetch(input: string | URL, init: RequestInit | undefined, opts?: ResilientFetchOptions): Promise<Response>;
//# sourceMappingURL=resilient-fetch.d.ts.map