import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { TypeArgPosition } from './types.js';
import { CONTAINER_DESCRIPTORS, ContainerDescriptor } from './constants.js';
import { extractElementTypeFromString } from './generics.js';

export function methodToTypeArgPosition(
  methodName: string | undefined,
  containerTypeName?: string,
): TypeArgPosition {
  if (containerTypeName) {
    const desc = CONTAINER_DESCRIPTORS.get(containerTypeName);
    if (desc) {
      if (desc.arity === 1) return 'last';
      if (methodName && desc.keyMethods.has(methodName)) return 'first';
      return 'last';
    }
  }
  if (methodName && (methodName === 'keys' || methodName === 'keySet' || methodName === 'Keys')) {
    return 'first';
  }
  return 'last';
}

export function getContainerDescriptor(typeName: string): ContainerDescriptor | undefined {
  return CONTAINER_DESCRIPTORS.get(typeName);
}

export function resolveIterableElementType(
  iterableName: string,
  node: SyntaxNode,
  scopeEnv: ReadonlyMap<string, string>,
  declarationTypeNodes: ReadonlyMap<string, SyntaxNode>,
  scope: string,
  extractFromTypeNode: (typeNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined,
  findParamElementType?: (
    name: string,
    startNode: SyntaxNode,
    pos?: TypeArgPosition,
  ) => string | undefined,
  typeArgPos: TypeArgPosition = 'last',
): string | undefined {
  const typeNode =
    declarationTypeNodes.get(`${scope}\0${iterableName}`) ??
    (scope !== '' ? declarationTypeNodes.get(`\0${iterableName}`) : undefined);
  if (typeNode) {
    const t = extractFromTypeNode(typeNode, typeArgPos);
    if (t) return t;
  }
  const iterableType = scopeEnv.get(iterableName);
  if (iterableType) {
    const el = extractElementTypeFromString(iterableType, typeArgPos);
    if (el) return el;
  }
  if (findParamElementType) return findParamElementType(iterableName, node, typeArgPos);
  return undefined;
}
