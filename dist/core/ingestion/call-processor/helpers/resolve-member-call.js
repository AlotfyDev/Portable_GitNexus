import { resolveMethodByOwner } from './receiver-resolution.js';
import { toResolveResult } from './callable-candidates.js';
export const resolveMemberCall = (ownerType, methodName, currentFile, ctx, heritageMap, argCount, ancestryView) => {
    const resolved = resolveMethodByOwner(ownerType, methodName, currentFile, ctx, heritageMap, argCount, ancestryView);
    if (!resolved)
        return null;
    return toResolveResult(resolved.def, resolved.tier);
};
