import { CircuitBreaker } from '../../_shared/index.js';
/** Per-attempt timeout for the full model download (5 minutes). */
export declare const HF_DOWNLOAD_TIMEOUT_MS: number;
/** Maximum total download attempts (1 initial + N-1 retries). */
export declare const HF_MAX_ATTEMPTS = 3;
/** Initial delay between retry attempts; doubles on each subsequent retry. */
export declare const HF_BASE_DELAY_MS = 2000;
/** Number of consecutive failures required to open the circuit. */
export declare const CB_FAILURE_THRESHOLD = 3;
/** How long the circuit stays open before transitioning to half-open. */
export declare const CB_RESET_TIMEOUT_MS = 60000;
/** Upper bound clamped on the env-override per-attempt timeout (30 minutes). */
export declare const HF_MAX_TIMEOUT_MS: number;
/** Upper bound clamped on the env-override attempt count. */
export declare const HF_MAX_ATTEMPTS_CAP = 10;
/**
 * @internal Exported only for unit tests and the two embedder entry points
 * (`core/embeddings/embedder.ts` + `mcp/core/embedder.ts`). Not part of the
 * public package API.
 *
 * Minimal subset of `@huggingface/transformers`' `env` object that gitnexus
 * mutates. Defining a local structural type keeps this helper free of a
 * transitive dependency on transformers' generated `.d.ts` while still
 * giving full type-checking on the two fields we actually touch.
 */
export interface HfEnvSubset {
    cacheDir: string;
    remoteHost: string;
}
/**
 * @internal Exported only for unit tests and the two embedder entry points
 * (`core/embeddings/embedder.ts` + `mcp/core/embedder.ts`). Not part of the
 * public package API.
 *
 * Apply user-controlled HuggingFace environment overrides to the
 * `@huggingface/transformers` `env` object. Centralises the two env-var
 * bridges so every gitnexus embedder entry point (the analyze pipeline
 * and the MCP server) behaves identically.
 *
 * - **`HF_HOME`** → `env.cacheDir` (default: `~/.cache/huggingface`).
 *   transformers.js otherwise defaults to `./node_modules/.cache` inside
 *   its own install dir, which is unwritable when gitnexus is installed
 *   globally (e.g. `/usr/lib/node_modules/`).
 *
 * - **`HF_ENDPOINT`** → `env.remoteHost` (#1205). transformers.js does
 *   not read `HF_ENDPOINT` on its own — it reads `env.remoteHost` —
 *   even though `HF_ENDPOINT` is the standard env var the upstream
 *   `huggingface_hub` Python client and the official HF mirror docs
 *   tell users to set. Bridging the two unblocks `--embeddings` for
 *   users behind networks where `huggingface.co` is unreachable
 *   (corporate proxies, the GFW, air-gapped mirrors). The trailing
 *   slash is normalised because transformers.js builds URLs by string
 *   concatenation and a missing slash silently falls through to its
 *   default `huggingface.co/...` host.
 *
 * Mutation rather than return-and-apply because callers already hold a
 * reference to the live `env` object imported from
 * `@huggingface/transformers` — passing the same reference in keeps the
 * call site a single line at each entry point.
 */
export declare function applyHfEnvOverrides(env: HfEnvSubset): void;
/**
 * @internal Exported for unit tests and the two embedder entry points.
 *
 * Returns true when an error message indicates a network-level fetch failure
 * during HuggingFace model download (e.g. `TypeError: fetch failed`,
 * `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`).
 *
 * These errors are not device-specific and cannot be fixed by falling back to
 * a different ONNX device — the caller should rethrow immediately with
 * guidance about `HF_ENDPOINT`.
 */
export declare function isNetworkFetchError(message: string): boolean;
/** @internal Used by `withHfDownloadRetry` to mark a circuit-open rejection. */
export declare const CIRCUIT_OPEN_TAG = "hf-circuit-open";
/**
 * Module-level singleton shared by both embedder entry points
 * (`core/embeddings/embedder.ts` + `mcp/core/embedder.ts`). Per-process
 * only — not persisted across restarts. Backed by the shared
 * `CircuitBreaker` from `gitnexus-shared` (same state machine, same
 * semantics, plus the single-permit half-open gate that prevents
 * recovery-time stampedes).
 */
export declare const hfDownloadCircuit: CircuitBreaker;
/** @internal Returns true for errors that should abort without retry (circuit-open). */
export declare function isHfCircuitOpenError(message: string): boolean;
/**
 * Returns true for any HuggingFace download failure that warrants showing the
 * `HF_ENDPOINT` remediation hint: either a raw network error or a
 * circuit-open rejection (which itself was caused by repeated network errors).
 */
export declare function isHfDownloadFailure(message: string): boolean;
/** @internal Wraps `fn` in a hard time-limit. The timeout error contains
 *  `ETIMEDOUT` so that `isNetworkFetchError` classifies it correctly.
 */
export declare function withDownloadTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T>;
export interface HfRetryOptions {
    /** Maximum total attempts including the initial one (default: `HF_MAX_ATTEMPTS`). */
    maxAttempts?: number;
    /** Delay before the first retry; doubles on each subsequent attempt (default: `HF_BASE_DELAY_MS`). */
    baseDelayMs?: number;
    /** Per-attempt wall-clock timeout in ms (default: `HF_DOWNLOAD_TIMEOUT_MS`). */
    timeoutMs?: number;
    /**
     * Circuit-breaker instance to use. Defaults to the module-level
     * `hfDownloadCircuit` singleton. Pass a fresh instance in tests.
     */
    circuit?: CircuitBreaker;
    /**
     * Optional callback invoked before each retry (not the initial attempt).
     * @param attempt - 1-based retry number
     * @param max - total allowed attempts
     * @param error - the error that triggered the retry
     */
    onRetry?: (attempt: number, max: number, error: Error) => void;
}
/**
 * Retry wrapper for HuggingFace model downloads with per-attempt timeout and
 * circuit-breaker protection.
 *
 * Behaviour:
 * - If the circuit is **open**, fails immediately with a `CIRCUIT_OPEN_TAG`
 *   message (so `isHfDownloadFailure` still returns true and the caller can
 *   show `HF_ENDPOINT` guidance).
 * - Each attempt is wrapped in `withDownloadTimeout`.
 * - On a network-level error (`isNetworkFetchError`) the attempt is retried
 *   with exponential back-off; non-network errors (e.g. ONNX device failure)
 *   are rethrown immediately without retry.
 * - Every network failure is recorded on the circuit breaker; a success resets
 *   it.
 * - After all attempts are exhausted, the last network error is rethrown
 *   so the existing `isNetworkFetchError` / `isHfDownloadFailure` guards in
 *   the calling code still fire.
 */
export declare function withHfDownloadRetry<T>(fn: () => Promise<T>, options?: HfRetryOptions): Promise<T>;
