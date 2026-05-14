import type { ResolveResult, OverloadHints } from '../types.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { TieredCandidates } from '../../model/resolution-context.js';
import type { SymbolDefinition } from 'gitnexus-shared';
import { CLASS_LIKE_TYPES, INSTANTIABLE_CLASS_TYPES } from '../constants.js';
import { filterCallableCandidates, toResolveResult } from './callable-candidates.js';
import { resolveProviderPrimaryTypeCandidate } from './provider-primary-resolver.js';
import { disambiguateByOverloadOrArgTypes } from './overload-disambiguation.js';

export const resolveStaticCall = (
  className: string,
  currentFile: string,
  ctx: ResolutionContext,
  argCount?: number,
  tieredOverride?: TieredCandidates,
  overloadHints?: OverloadHints,
  preComputedArgTypes?: (string | undefined)[],
): ResolveResult | null => {
  const allClasses = ctx.model.types.lookupClassByName(className);
  if (allClasses.length === 0) return null;

  const typeResolved = tieredOverride ?? ctx.resolve(className, currentFile);
  if (!typeResolved) return null;

  const classCandidates = typeResolved.candidates.filter((c) => CLASS_LIKE_TYPES.has(c.type));
  if (classCandidates.length === 0) return null;

  let firstDef: SymbolDefinition | undefined;
  let ambiguous = false;
  for (const candidate of classCandidates) {
    const def = ctx.model.methods.lookupMethodByOwner(candidate.nodeId, className, argCount);
    if (!def || def.type !== 'Constructor') continue;
    if (!firstDef) {
      firstDef = def;
    } else if (def.nodeId !== firstDef.nodeId) {
      ambiguous = true;
      break;
    }
  }

  if (firstDef && !ambiguous) {
    return toResolveResult(firstDef, typeResolved.tier);
  }

  if (typeResolved.candidates.some((c) => c.type === 'Constructor')) {
    if (overloadHints || preComputedArgTypes) {
      const ctorPool = filterCallableCandidates(typeResolved.candidates, argCount, 'constructor');
      if (ctorPool.length > 1) {
        const disambiguated = disambiguateByOverloadOrArgTypes(
          ctorPool,
          overloadHints,
          preComputedArgTypes,
        );
        if (disambiguated) return toResolveResult(disambiguated, typeResolved.tier);
      }
    }
    return null;
  }

  const instantiableCandidates = classCandidates.filter((c) =>
    INSTANTIABLE_CLASS_TYPES.has(c.type),
  );
  const primary = resolveProviderPrimaryTypeCandidate(
    instantiableCandidates,
    typeResolved.tier,
    className,
    currentFile,
  );
  if (primary) return primary;

  if (instantiableCandidates.length === 1) {
    return toResolveResult(instantiableCandidates[0], typeResolved.tier);
  }

  return null;
};
