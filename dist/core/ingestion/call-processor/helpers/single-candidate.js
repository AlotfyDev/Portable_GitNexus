import { filterCallableCandidates, toResolveResult } from './callable-candidates.js';
export const singleCandidate = (tiered, argCount, callForm) => {
    const filtered = filterCallableCandidates(tiered.candidates, argCount, callForm);
    return filtered.length === 1 ? toResolveResult(filtered[0], tiered.tier) : null;
};
