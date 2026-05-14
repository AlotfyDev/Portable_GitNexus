/**
 * Cross-repo impact (Phase 1 local walk + Phase 2 bridge fan-out).
 * All bridge Cypher for this feature lives in this module.
 */
import type { GroupImpactResult } from './types.js';
import type { GroupToolPort } from './service.js';
/** Cross-boundary hops beyond this value are clamped (multi-hop reserved for future work). */
export declare const MAX_SUPPORTED_CROSS_DEPTH = 1;
/** Default wall-clock budget for the Phase 1 `impact` leg when callers omit `timeoutMs`. */
export declare const DEFAULT_LOCAL_IMPACT_TIMEOUT_MS = 30000;
export interface RunGroupImpactDeps {
    port: GroupToolPort;
    gitnexusDir: string;
}
/**
 * Clamp the impact timeout to a sane bounded range. Callers can feed this
 * via tool params, so an unclamped value lets a single request hold a
 * timer slot for an arbitrarily long duration (CodeQL js/resource-
 * exhaustion). 100ms lower bound preserves test-suite scenarios that
 * exercise tight timeouts; 5min upper bound is well above any legitimate
 * single-impact compute. Applied at the validate boundary so the
 * downstream `deadline` (Date.now() + timeoutMs) and the local-leg
 * `setTimeout` see the same clamped value — earlier shapes had a 1hr
 * outer cap and a 5min inner clamp that disagreed.
 */
export declare const IMPACT_TIMEOUT_MIN_MS = 100;
export declare const IMPACT_TIMEOUT_MAX_MS: number;
export declare function clampTimeout(timeoutMs: number): number;
export declare function validateGroupImpactParams(params: Record<string, unknown>): {
    ok: true;
    name: string;
    repoPath: string;
    target: string;
    direction: 'upstream' | 'downstream';
    maxDepth: number;
    crossDepth: number;
    crossDepthWarning?: string;
    relationTypes?: string[];
    includeTests: boolean;
    minConfidence: number;
    service?: string;
    subgroup?: string;
    timeoutMs: number;
} | {
    ok: false;
    error: string;
};
/**
 * Race a single Phase-2 `impactByUid` call against a remaining-budget
 * timer. The Codex adversarial review on PR #1331 surfaced that the
 * fanout loop only checked `Date.now() > deadline` *between* neighbor
 * calls — once `await port.impactByUid(...)` was reached, a hung
 * neighbor could pin the request indefinitely, and slow neighbors
 * could compound past the 5-min `IMPACT_TIMEOUT_MAX_MS` cap.
 *
 * This helper wraps each call: a `setTimeout(remainingMs)` aborts an
 * `AbortController` whose signal is forwarded to `impactByUid`, and a
 * `Promise.race` resolves to `{ timedOut: true }` when the timer
 * fires before the call completes. Implementors that ignore the
 * signal (current local backend) still see their await resolved by
 * the race; full cooperative cancellation inside the BFS is a future
 * follow-up. On rejection, the value is `null` (matching the
 * fanout's existing `if (fan == null)` truncation contract).
 *
 * Exported for direct unit testing — the helper IS the load-bearing
 * mitigation surface, so the U3 regression test pins it directly
 * rather than driving the full `runGroupImpact` path.
 */
export declare function safeNeighborImpact(port: GroupToolPort, repoId: string, uid: string, direction: string, opts: {
    maxDepth: number;
    relationTypes: string[];
    minConfidence: number;
    includeTests: boolean;
}, remainingMs: number): Promise<{
    value: unknown;
    timedOut: boolean;
}>;
export declare function collectImpactSymbolUids(local: unknown, servicePrefix: string | undefined): {
    uids: string[];
    targetFilePath?: string;
};
export declare function runGroupImpact(deps: RunGroupImpactDeps, params: Record<string, unknown>): Promise<GroupImpactResult | {
    error: string;
}>;
export { normalizeServicePrefix, fileMatchesServicePrefix } from './group-path-utils.js';
