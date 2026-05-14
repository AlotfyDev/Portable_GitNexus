import type { SymbolDefinition } from 'gitnexus-shared';
import type { ResolveResult } from '../types.js';
import type { ResolutionTier } from '../../model/resolution-context.js';
import { toResolveResult } from './callable-candidates.js';
import { getLanguageFromFilename } from 'gitnexus-shared';
import { getProvider } from '../../languages/index.js';


const orderProviderSameNameTypeCandidates = (
  candidates: readonly SymbolDefinition[],
  typeName: string,
  filePath: string,
): readonly SymbolDefinition[] | null => {
  const language = getLanguageFromFilename(filePath);
  if (language == null) return null;
  return (
    getProvider(language).orderSameNameTypeCandidates?.({
      typeName,
      callSiteFilePath: filePath,
      candidates,
    }) ?? null
  );
};

export const resolveProviderPrimaryTypeCandidate = (
  candidates: readonly SymbolDefinition[],
  tier: ResolutionTier,
  typeName: string,
  filePath: string,
): ResolveResult | null => {
  const ordered = orderProviderSameNameTypeCandidates(candidates, typeName, filePath);
  return ordered && ordered.length > 0 ? toResolveResult(ordered[0], tier) : null;
};

export { orderProviderSameNameTypeCandidates };
