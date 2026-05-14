import type { DispatchDecision } from '../call-types.js';
/**
 * DAG stage 4 fallback: used when `selectDispatch` is absent or returns null.
 * Preserves pre-DAG dispatch semantics.
 * `undefined` callForm MUST route through owner-scoped (not free) so bare
 * identifiers without a classified shape do NOT trigger `resolveFreeCall`'s
 * class-target fast path.
 */
export declare const defaultDispatchDecision: (callForm: "free" | "member" | "constructor" | undefined) => DispatchDecision;
