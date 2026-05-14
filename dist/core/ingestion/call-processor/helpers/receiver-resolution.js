import { CLASS_LIKE_TYPES } from '../constants.js';
import { lookupMethodByOwnerWithMRO } from '../../model/index.js';
import { getLanguageFromFilename } from '../../../../_shared/index.js';
import { getProvider } from '../../languages/index.js';
import { orderProviderSameNameTypeCandidates } from './provider-primary-resolver.js';
import { stripNullable } from '../../type-extractors/shared.js';
export const receiverKey = (scope, varName) => `${scope}\0${varName}`;
export const buildReceiverTypeIndex = (map) => {
    const index = new Map();
    for (const [key, typeName] of map) {
        const nul = key.indexOf('\0');
        if (nul < 0)
            continue;
        const scope = key.slice(0, nul);
        const varName = key.slice(nul + 1);
        if (!varName)
            continue;
        if (scope !== '' && !scope.includes('@'))
            continue;
        const funcName = scope === '' ? '' : scope.slice(0, scope.indexOf('@'));
        let varMap = index.get(funcName);
        if (!varMap) {
            varMap = new Map();
            index.set(funcName, varMap);
        }
        const existing = varMap.get(varName);
        if (existing === undefined) {
            varMap.set(varName, { kind: 'resolved', value: typeName });
        }
        else if (existing.kind === 'resolved' && existing.value !== typeName) {
            varMap.set(varName, { kind: 'ambiguous' });
        }
    }
    return index;
};
export const lookupReceiverType = (index, funcName, varName) => {
    const funcBucket = index.get(funcName);
    if (funcBucket) {
        const entry = funcBucket.get(varName);
        if (entry?.kind === 'resolved')
            return entry.value;
        if (entry?.kind === 'ambiguous') {
            const fileEntry = index.get('')?.get(varName);
            return fileEntry?.kind === 'resolved' ? fileEntry.value : undefined;
        }
    }
    if (funcName !== '') {
        const fileEntry = index.get('')?.get(varName);
        if (fileEntry?.kind === 'resolved')
            return fileEntry.value;
    }
    return undefined;
};
export const resolveFieldAccessType = (receiverName, fieldName, filePath, ctx) => {
    const fieldDef = resolveFieldOwnership(receiverName, fieldName, filePath, ctx);
    if (!fieldDef?.declaredType)
        return undefined;
    return {
        typeName: stripNullable(fieldDef.declaredType),
        fieldNodeId: fieldDef.nodeId,
    };
};
export const resolveFieldOwnership = (receiverName, fieldName, filePath, ctx) => {
    const typeResolved = ctx.resolve(receiverName, filePath);
    if (!typeResolved)
        return undefined;
    const classDef = typeResolved.candidates.find((d) => CLASS_LIKE_TYPES.has(d.type));
    if (!classDef)
        return undefined;
    return ctx.model.fields.lookupFieldByOwner(classDef.nodeId, fieldName) ?? undefined;
};
export const resolveMethodByOwner = (receiverTypeName, methodName, filePath, ctx, heritageMap, argCount, ancestryView) => {
    const typeResolved = ctx.resolve(receiverTypeName, filePath);
    if (!typeResolved)
        return undefined;
    const language = heritageMap ? getLanguageFromFilename(filePath) : null;
    const mroStrategy = language != null ? getProvider(language).mroStrategy : null;
    const canWalkMRO = heritageMap != null && mroStrategy != null;
    let firstDef;
    let ambiguous = false;
    for (const candidate of typeResolved.candidates) {
        if (!CLASS_LIKE_TYPES.has(candidate.type))
            continue;
        const singletonOverride = ancestryView === 'singleton' && canWalkMRO && heritageMap
            ? heritageMap.getSingletonAncestry(candidate.nodeId).map((e) => e.parentId)
            : undefined;
        const def = canWalkMRO
            ? lookupMethodByOwnerWithMRO(candidate.nodeId, methodName, heritageMap, ctx.model, mroStrategy, argCount, singletonOverride)
            : ctx.model.methods.lookupMethodByOwner(candidate.nodeId, methodName, argCount);
        if (!def)
            continue;
        if (!firstDef) {
            firstDef = def;
        }
        else if (def.nodeId !== firstDef.nodeId) {
            ambiguous = true;
            break;
        }
    }
    if (!firstDef && !ambiguous) {
        const orderedTypeCandidates = orderProviderSameNameTypeCandidates(ctx.model.types.lookupClassByName(receiverTypeName), receiverTypeName, filePath);
        if (orderedTypeCandidates) {
            for (const candidate of orderedTypeCandidates) {
                const def = canWalkMRO
                    ? lookupMethodByOwnerWithMRO(candidate.nodeId, methodName, heritageMap, ctx.model, mroStrategy, argCount)
                    : ctx.model.methods.lookupMethodByOwner(candidate.nodeId, methodName, argCount);
                if (!def)
                    continue;
                if (!firstDef) {
                    firstDef = def;
                }
                else if (def.nodeId !== firstDef.nodeId) {
                    ambiguous = true;
                    break;
                }
            }
        }
    }
    if (!firstDef || ambiguous)
        return undefined;
    return { def: firstDef, tier: typeResolved.tier };
};
