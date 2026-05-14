import { FUNCTION_NODE_TYPES, genericFuncName, } from '../../utils/ast-helpers.js';
import { stripNullable } from '../../type-extractors/shared.js';
import { FAST_NULLABLE_KEYWORDS, NARROWING_BRANCH_TYPES, FILE_SCOPE } from '../constants.js';
import { findEnclosingClassName, findEnclosingParentClassName } from './class-lookup.js';
export const emptyFileScope = () => new Map();
export const findNarrowingBranchScope = (node) => {
    let current = node.parent;
    while (current) {
        if (NARROWING_BRANCH_TYPES.has(current.type))
            return current;
        if (FUNCTION_NODE_TYPES.has(current.type))
            return undefined;
        current = current.parent;
    }
    return undefined;
};
export const fastStripNullable = (typeName) => {
    if (FAST_NULLABLE_KEYWORDS.has(typeName))
        return undefined;
    return typeName.indexOf('|') === -1 && typeName.indexOf('?') === -1
        ? typeName
        : stripNullable(typeName);
};
export const lookupInEnv = (env, varName, callNode, patternOverrides, enclosingFunctionFinder, extractFunctionNameHook) => {
    if (varName === 'self' || varName === 'this' || varName === '$this') {
        return findEnclosingClassName(callNode);
    }
    if (varName === 'super' || varName === 'base' || varName === 'parent') {
        return findEnclosingParentClassName(callNode);
    }
    const scopeKey = findEnclosingScopeKey(callNode, enclosingFunctionFinder, extractFunctionNameHook);
    if (scopeKey && patternOverrides) {
        const varOverrides = patternOverrides.get(scopeKey)?.get(varName);
        if (varOverrides) {
            const pos = callNode.startIndex;
            for (const override of varOverrides) {
                if (pos >= override.rangeStart && pos <= override.rangeEnd) {
                    return fastStripNullable(override.typeName);
                }
            }
        }
    }
    if (scopeKey) {
        const scopeEnv = env.get(scopeKey);
        if (scopeEnv) {
            const result = scopeEnv.get(varName);
            if (result)
                return fastStripNullable(result);
        }
    }
    const fileEnv = env.get(FILE_SCOPE);
    const raw = fileEnv?.get(varName);
    return raw ? fastStripNullable(raw) : undefined;
};
export const findEnclosingScopeKey = (node, enclosingFunctionFinder, extractFunctionNameHook) => {
    let current = node.parent;
    while (current) {
        if (FUNCTION_NODE_TYPES.has(current.type)) {
            const funcName = extractFunctionNameHook?.(current)?.funcName ?? genericFuncName(current);
            if (funcName)
                return `${funcName}@${current.startIndex}`;
        }
        if (enclosingFunctionFinder) {
            const result = enclosingFunctionFinder(current);
            if (result) {
                const sigNode = current.previousSibling;
                const startIdx = sigNode?.startIndex ?? current.startIndex;
                return `${result.funcName}@${startIdx}`;
            }
        }
        current = current.parent;
    }
    return undefined;
};
