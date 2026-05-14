import { toResolveResult } from './callable-candidates.js';
import { getLanguageFromFilename } from '../../../../_shared/index.js';
import { getProvider } from '../../languages/index.js';
const orderProviderSameNameTypeCandidates = (candidates, typeName, filePath) => {
    const language = getLanguageFromFilename(filePath);
    if (language == null)
        return null;
    return (getProvider(language).orderSameNameTypeCandidates?.({
        typeName,
        callSiteFilePath: filePath,
        candidates,
    }) ?? null);
};
export const resolveProviderPrimaryTypeCandidate = (candidates, tier, typeName, filePath) => {
    const ordered = orderProviderSameNameTypeCandidates(candidates, typeName, filePath);
    return ordered && ordered.length > 0 ? toResolveResult(ordered[0], tier) : null;
};
export { orderProviderSameNameTypeCandidates };
