import { INSTANTIABLE_CLASS_TYPES } from '../constants.js';
import { filterCallableCandidates, toResolveResult } from './callable-candidates.js';
import { tryOverloadDisambiguation, matchCandidatesByArgTypes } from './overload-disambiguation.js';
import { resolveProviderPrimaryTypeCandidate } from './provider-primary-resolver.js';
import { resolveStaticCall } from './resolve-static-call.js';
export const resolveFreeCall = (calledName, filePath, ctx, argCount, tieredOverride, overloadHints, preComputedArgTypes) => {
    const tiered = tieredOverride ?? ctx.resolve(calledName, filePath);
    if (!tiered)
        return null;
    let filteredCandidates = filterCallableCandidates(tiered.candidates, argCount, 'free');
    const hasClassTarget = filteredCandidates.length === 0 &&
        tiered.candidates.some((c) => INSTANTIABLE_CLASS_TYPES.has(c.type));
    if (hasClassTarget) {
        const staticResult = resolveStaticCall(calledName, filePath, ctx, argCount, tiered);
        if (staticResult)
            return staticResult;
        filteredCandidates = filterCallableCandidates(tiered.candidates, argCount, 'constructor');
    }
    if (filteredCandidates.length > 1) {
        const disambiguated = overloadHints
            ? tryOverloadDisambiguation(filteredCandidates, overloadHints)
            : preComputedArgTypes
                ? matchCandidatesByArgTypes(filteredCandidates, preComputedArgTypes)
                : null;
        if (disambiguated)
            return toResolveResult(disambiguated, tiered.tier);
    }
    if (filteredCandidates.length !== 1) {
        const primary = resolveProviderPrimaryTypeCandidate(filteredCandidates, tiered.tier, calledName, filePath);
        if (primary)
            return primary;
        return null;
    }
    return toResolveResult(filteredCandidates[0], tiered.tier);
};
