import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { extractSimpleTypeName } from './simple-type.js';

export const extractRubyConstructorAssignment = (
  node: SyntaxNode,
): { varName: string; calleeName: string } | undefined => {
  if (node.type !== 'assignment') return undefined;
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  if (!left || !right) return undefined;
  if (left.type !== 'identifier' && left.type !== 'constant') return undefined;
  if (right.type !== 'call') return undefined;
  const method = right.childForFieldName('method');
  if (!method || method.text !== 'new') return undefined;
  const receiver = right.childForFieldName('receiver');
  if (!receiver) return undefined;
  let calleeName: string;
  if (receiver.type === 'constant') {
    calleeName = receiver.text;
  } else if (receiver.type === 'scope_resolution') {
    const last = receiver.lastNamedChild;
    if (!last || last.type !== 'constant') return undefined;
    calleeName = last.text;
  } else {
    return undefined;
  }
  return { varName: left.text, calleeName };
};

export const hasTypeAnnotation = (node: SyntaxNode): boolean => {
  if (node.childForFieldName('type')) return true;
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i)?.type === 'type_annotation') return true;
  }
  return false;
};

export const unwrapAwait = (node: SyntaxNode | null): SyntaxNode | null => {
  if (!node) return null;
  return node.type === 'await_expression' ? node.firstNamedChild : node;
};

export const extractCalleeName = (callNode: SyntaxNode): string | undefined => {
  const func = callNode.childForFieldName('function') ?? callNode.firstNamedChild;
  if (!func) return undefined;
  return extractSimpleTypeName(func);
};
