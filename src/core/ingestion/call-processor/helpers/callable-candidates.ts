import type { SymbolDefinition } from 'gitnexus-shared';
import { CALL_TARGET_TYPES } from '../../model/index.js';
import { CONSTRUCTOR_TARGET_TYPES } from '../constants.js';
import { TIER_CONFIDENCE, type ResolutionTier } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';

export const filterCallableCandidates = (
  candidates: readonly SymbolDefinition[],
  argCount?: number,
  callForm?: 'free' | 'member' | 'constructor',
): SymbolDefinition[] => {
  let kindFiltered: SymbolDefinition[];

  if (callForm === 'constructor') {
    const constructors = candidates.filter((c) => c.type === 'Constructor');
    if (constructors.length > 0) {
      kindFiltered = constructors;
    } else {
      const types = candidates.filter((c) => CONSTRUCTOR_TARGET_TYPES.has(c.type));
      kindFiltered =
        types.length > 0 ? types : candidates.filter((c) => CALL_TARGET_TYPES.has(c.type));
    }
  } else {
    kindFiltered = candidates.filter((c) => CALL_TARGET_TYPES.has(c.type));
  }

  if (kindFiltered.length === 0) return [];
  if (argCount === undefined) return kindFiltered;

  const hasParameterMetadata = kindFiltered.some(
    (candidate) => candidate.parameterCount !== undefined,
  );
  if (!hasParameterMetadata) return kindFiltered;

  return kindFiltered.filter(
    (candidate) =>
      candidate.parameterCount === undefined ||
      (argCount >= (candidate.requiredParameterCount ?? candidate.parameterCount) &&
        argCount <= candidate.parameterCount),
  );
};

/**
 * Count callable candidates matching the kind + arity filter without
 * allocating an intermediate array. Short-circuits once count exceeds `threshold`.
 */
export const countCallableCandidates = (
  candidates: readonly SymbolDefinition[],
  argCount?: number,
  callForm?: 'free' | 'member' | 'constructor',
  threshold = 1,
): number => {
  let count = 0;
  for (const c of candidates) {
    const typeOk =
      callForm === 'constructor'
        ? CONSTRUCTOR_TARGET_TYPES.has(c.type)
        : CALL_TARGET_TYPES.has(c.type);
    if (!typeOk) continue;
    if (
      argCount !== undefined &&
      c.parameterCount !== undefined &&
      (argCount < (c.requiredParameterCount ?? c.parameterCount) || argCount > c.parameterCount)
    ) {
      continue;
    }
    count++;
    if (count > threshold) return count;
  }
  return count;
};

export const toResolveResult = (definition: SymbolDefinition, tier: ResolutionTier): ResolveResult => ({
  nodeId: definition.nodeId,
  confidence: TIER_CONFIDENCE[tier],
  reason:
    tier === 'same-file' ? 'same-file' : tier === 'import-scoped' ? 'import-resolved' : 'global',
  returnType: definition.returnType,
});
