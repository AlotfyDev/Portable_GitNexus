import { TYPE_PRESERVING_METHODS } from '../constants.js';
import { resolveFieldAccessType, resolveMethodByOwner } from './receiver-resolution.js';
import { extractReturnTypeName } from '../../type-extractors/shared.js';
import { resolveCallTarget } from './resolve-call-target.js';
export const walkMixedChain = (chain, startType, filePath, ctx, onFieldResolved, heritageMap) => {
    let currentType = startType;
    for (const step of chain) {
        if (!currentType)
            break;
        if (step.kind === 'field') {
            const resolved = resolveFieldAccessType(currentType, step.name, filePath, ctx);
            if (!resolved) {
                currentType = undefined;
                break;
            }
            onFieldResolved?.(resolved.fieldNodeId);
            currentType = resolved.typeName;
        }
        else {
            const fieldResolved = resolveFieldAccessType(currentType, step.name, filePath, ctx);
            if (fieldResolved) {
                onFieldResolved?.(fieldResolved.fieldNodeId);
                currentType = fieldResolved.typeName;
                continue;
            }
            const owned = resolveMethodByOwner(currentType, step.name, filePath, ctx, heritageMap);
            if (owned?.def.returnType) {
                const fastRetType = extractReturnTypeName(owned.def.returnType);
                if (fastRetType) {
                    currentType = fastRetType;
                    continue;
                }
            }
            const resolved = resolveCallTarget({ calledName: step.name, callForm: 'member', receiverTypeName: currentType }, filePath, ctx, undefined, undefined, undefined, heritageMap);
            if (!resolved) {
                if (TYPE_PRESERVING_METHODS.has(step.name))
                    continue;
                currentType = undefined;
                break;
            }
            if (!resolved.returnType) {
                currentType = undefined;
                break;
            }
            const retType = extractReturnTypeName(resolved.returnType);
            if (!retType) {
                currentType = undefined;
                break;
            }
            currentType = retType;
        }
    }
    return currentType;
};
