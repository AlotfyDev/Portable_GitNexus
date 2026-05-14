import { CONTAINER_DESCRIPTORS } from './constants.js';
import { extractElementTypeFromString } from './generics.js';
export function methodToTypeArgPosition(methodName, containerTypeName) {
    if (containerTypeName) {
        const desc = CONTAINER_DESCRIPTORS.get(containerTypeName);
        if (desc) {
            if (desc.arity === 1)
                return 'last';
            if (methodName && desc.keyMethods.has(methodName))
                return 'first';
            return 'last';
        }
    }
    if (methodName && (methodName === 'keys' || methodName === 'keySet' || methodName === 'Keys')) {
        return 'first';
    }
    return 'last';
}
export function getContainerDescriptor(typeName) {
    return CONTAINER_DESCRIPTORS.get(typeName);
}
export function resolveIterableElementType(iterableName, node, scopeEnv, declarationTypeNodes, scope, extractFromTypeNode, findParamElementType, typeArgPos = 'last') {
    const typeNode = declarationTypeNodes.get(`${scope}\0${iterableName}`) ??
        (scope !== '' ? declarationTypeNodes.get(`\0${iterableName}`) : undefined);
    if (typeNode) {
        const t = extractFromTypeNode(typeNode, typeArgPos);
        if (t)
            return t;
    }
    const iterableType = scopeEnv.get(iterableName);
    if (iterableType) {
        const el = extractElementTypeFromString(iterableType, typeArgPos);
        if (el)
            return el;
    }
    if (findParamElementType)
        return findParamElementType(iterableName, node, typeArgPos);
    return undefined;
}
