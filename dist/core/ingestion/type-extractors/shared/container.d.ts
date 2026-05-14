import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { TypeArgPosition } from './types.js';
import { ContainerDescriptor } from './constants.js';
export declare function methodToTypeArgPosition(methodName: string | undefined, containerTypeName?: string): TypeArgPosition;
export declare function getContainerDescriptor(typeName: string): ContainerDescriptor | undefined;
export declare function resolveIterableElementType(iterableName: string, node: SyntaxNode, scopeEnv: ReadonlyMap<string, string>, declarationTypeNodes: ReadonlyMap<string, SyntaxNode>, scope: string, extractFromTypeNode: (typeNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined, findParamElementType?: (name: string, startNode: SyntaxNode, pos?: TypeArgPosition) => string | undefined, typeArgPos?: TypeArgPosition): string | undefined;
