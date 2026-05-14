import { findChild, type SyntaxNode } from '../../../utils/ast-helpers.js';
import type { ClassNameLookup } from '../../types.js';
import {
  extractSimpleTypeName,
  extractGenericTypeArgs,
  type TypeArgPosition,
} from '../../shared.js';

/** Find the constructor callee name in a Kotlin property_declaration's initializer. */
export const findKotlinConstructorCallee = (
  node: SyntaxNode,
  classNames: ClassNameLookup,
): string | undefined => {
  if (node.type !== 'property_declaration') return undefined;
  const value = node.childForFieldName('value') ?? findChild(node, 'call_expression');
  if (!value || value.type !== 'call_expression') return undefined;
  const callee = value.firstNamedChild;
  if (!callee || callee.type !== 'simple_identifier') return undefined;
  const calleeName = callee.text;
  if (!calleeName || !classNames.has(calleeName)) return undefined;
  return calleeName;
};

/** Extract element type from a Kotlin type annotation AST node (user_type wrapping generic). */
export const extractKotlinElementTypeFromTypeNode = (
  typeNode: SyntaxNode,
  pos: TypeArgPosition = 'last',
): string | undefined => {
  if (typeNode.type === 'user_type') {
    const argsNode = findChild(typeNode, 'type_arguments');
    if (argsNode && argsNode.namedChildCount >= 1) {
      const targetArg =
        pos === 'first'
          ? argsNode.namedChild(0)
          : argsNode.namedChild(argsNode.namedChildCount - 1);
      if (!targetArg) return undefined;
      const inner = targetArg.type === 'type_projection' ? targetArg.firstNamedChild : targetArg;
      if (inner) return extractSimpleTypeName(inner);
    }
  }
  return undefined;
};

/** Walk up from a for-loop to the enclosing function_declaration and search parameters. */
export const findKotlinParamElementType = (
  iterableName: string,
  startNode: SyntaxNode,
  pos: TypeArgPosition = 'last',
): string | undefined => {
  let current: SyntaxNode | null = startNode.parent;
  while (current) {
    if (current.type === 'function_declaration') {
      const paramsNode = findChild(current, 'function_value_parameters');
      if (paramsNode) {
        for (let i = 0; i < paramsNode.namedChildCount; i++) {
          const param = paramsNode.namedChild(i);
          if (!param || param.type !== 'parameter') continue;
          const nameNode = findChild(param, 'simple_identifier');
          if (nameNode?.text !== iterableName) continue;
          const typeNode = findChild(param, 'user_type');
          if (typeNode) return extractKotlinElementTypeFromTypeNode(typeNode, pos);
        }
      }
      break;
    }
    current = current.parent;
  }
  return undefined;
};
