import type { ResolveResult } from '../types.js';
import type { HeritageMap } from '../../model/index.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import { resolveMethodByOwner } from './receiver-resolution.js';
import { toResolveResult } from './callable-candidates.js';

export const resolveMemberCall = (
  ownerType: string,
  methodName: string,
  currentFile: string,
  ctx: ResolutionContext,
  heritageMap?: HeritageMap,
  argCount?: number,
  ancestryView?: 'instance' | 'singleton',
): ResolveResult | null => {
  const resolved = resolveMethodByOwner(
    ownerType,
    methodName,
    currentFile,
    ctx,
    heritageMap,
    argCount,
    ancestryView,
  );
  if (!resolved) return null;
  return toResolveResult(resolved.def, resolved.tier);
};
