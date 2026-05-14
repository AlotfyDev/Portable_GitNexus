import type { TieredCandidates } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';
import { filterCallableCandidates, toResolveResult } from './callable-candidates.js';

export const singleCandidate = (
  tiered: TieredCandidates,
  argCount?: number,
  callForm?: 'free' | 'member' | 'constructor',
): ResolveResult | null => {
  const filtered = filterCallableCandidates(tiered.candidates, argCount, callForm);
  return filtered.length === 1 ? toResolveResult(filtered[0], tiered.tier) : null;
};
