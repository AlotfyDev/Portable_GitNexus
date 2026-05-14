import { extractCallArgTypes } from '../../utils/call-analysis.js';
import { KOTLIN_BOXED_TO_PRIMITIVE } from '../constants.js';
const normalizeJvmTypeName = (name) => KOTLIN_BOXED_TO_PRIMITIVE[name] ?? name;
const matchCandidatesByArgTypes = (candidates, argTypes) => {
    if (!candidates.some((c) => c.parameterTypes))
        return null;
    const matched = candidates.filter((c) => {
        if (!c.parameterTypes)
            return true;
        return c.parameterTypes.every((pType, i) => {
            if (i >= argTypes.length || !argTypes[i])
                return true;
            return normalizeJvmTypeName(pType) === argTypes[i];
        });
    });
    if (matched.length === 1)
        return matched[0];
    if (matched.length > 1) {
        const uniqueIds = new Set(matched.map((c) => c.nodeId));
        if (uniqueIds.size === 1)
            return matched[0];
    }
    return null;
};
const tryOverloadDisambiguation = (candidates, hints) => {
    const argTypes = extractCallArgTypes(hints.callNode, hints.inferLiteralType, hints.typeEnv ? (varName, cn) => hints.typeEnv.lookup(varName, cn) : undefined);
    if (!argTypes)
        return null;
    return matchCandidatesByArgTypes(candidates, argTypes);
};
export const disambiguateByOverloadOrArgTypes = (pool, overloadHints, preComputedArgTypes) => {
    if (!overloadHints && !preComputedArgTypes)
        return null;
    if (overloadHints)
        return tryOverloadDisambiguation(pool, overloadHints);
    if (preComputedArgTypes)
        return matchCandidatesByArgTypes(pool, preComputedArgTypes);
    return null;
};
export { matchCandidatesByArgTypes, tryOverloadDisambiguation, normalizeJvmTypeName };
