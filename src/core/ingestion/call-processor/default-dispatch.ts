import type { DispatchDecision } from '../call-types.js';

/** Shorthand for the receiver-source discriminant shared across the DAG. */
type ReceiverSource = import('../call-types.js').ReceiverEnriched['receiverSource'];

/**
 * DAG stage 4 fallback: used when `selectDispatch` is absent or returns null.
 * Preserves pre-DAG dispatch semantics.
 * `undefined` callForm MUST route through owner-scoped (not free) so bare
 * identifiers without a classified shape do NOT trigger `resolveFreeCall`'s
 * class-target fast path.
 */
export const defaultDispatchDecision = (
  callForm: 'free' | 'member' | 'constructor' | undefined,
): DispatchDecision => {
  if (callForm === 'constructor') return { primary: 'constructor' };
  if (callForm === 'free') return { primary: 'free' };
  return { primary: 'owner-scoped' };
};
