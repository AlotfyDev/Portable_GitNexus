import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { TypeArgPosition } from './types.js';
import { extractSimpleTypeName } from './simple-type.js';

function extractFirstArg(args: string): string {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === '<' || ch === '[') depth++;
    else if (ch === '>' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) return args.slice(0, i).trim();
  }
  return args.trim();
}

export const extractGenericTypeArgs = (typeNode: SyntaxNode, depth = 0): string[] => {
  if (depth > 50) return [];
  if (
    typeNode.type === 'type_annotation' ||
    typeNode.type === 'type' ||
    typeNode.type === 'user_type' ||
    typeNode.type === 'nullable_type' ||
    typeNode.type === 'optional_type'
  ) {
    const inner = typeNode.firstNamedChild;
    if (inner) return extractGenericTypeArgs(inner, depth + 1);
    return [];
  }

  if (
    typeNode.type !== 'generic_type' &&
    typeNode.type !== 'parameterized_type' &&
    typeNode.type !== 'generic_name'
  ) {
    return [];
  }

  let argsNode: SyntaxNode | null = null;
  for (let i = 0; i < typeNode.namedChildCount; i++) {
    const child = typeNode.namedChild(i);
    if (child && (child.type === 'type_arguments' || child.type === 'type_argument_list')) {
      argsNode = child;
      break;
    }
  }
  if (!argsNode) return [];

  const result: string[] = [];
  for (let i = 0; i < argsNode.namedChildCount; i++) {
    let argNode = argsNode.namedChild(i);
    if (!argNode) continue;

    if (argNode.type === 'type_projection') {
      argNode = argNode.firstNamedChild;
      if (!argNode) continue;
    }

    const name = extractSimpleTypeName(argNode);
    if (name) result.push(name);
  }

  return result;
};

export function extractElementTypeFromString(
  typeStr: string,
  pos: TypeArgPosition = 'last',
): string | undefined {
  if (!typeStr || typeStr.length === 0 || typeStr.length > 2048) return undefined;

  if (typeStr.endsWith('[]')) {
    const base = typeStr.slice(0, -2).trim();
    return base && /^\w+$/.test(base) ? base : undefined;
  }

  if (typeStr.startsWith('[]')) {
    const element = typeStr.slice(2).trim();
    return element && /^\w+$/.test(element) ? element : undefined;
  }

  if (typeStr.startsWith('[') && typeStr.endsWith(']') && !typeStr.includes('<')) {
    const element = typeStr.slice(1, -1).trim();
    return element && /^\w+$/.test(element) ? element : undefined;
  }

  const openAngle = typeStr.indexOf('<');
  const openSquare = typeStr.indexOf('[');

  let openIdx = -1;
  let openChar = '';
  let closeChar = '';

  if (openAngle >= 0 && (openSquare < 0 || openAngle < openSquare)) {
    openIdx = openAngle;
    openChar = '<';
    closeChar = '>';
  } else if (openSquare >= 0) {
    openIdx = openSquare;
    openChar = '[';
    closeChar = ']';
  }

  if (openIdx < 0) return undefined;

  let depth = 0;
  const start = openIdx + 1;
  let lastCommaIdx = -1;
  for (let i = start; i < typeStr.length; i++) {
    const ch = typeStr[i];
    if (ch === '<' || ch === '[') {
      depth++;
    } else if (ch === '>' || ch === ']') {
      if (depth === 0) {
        if (ch !== closeChar) return undefined;
        if (pos === 'last' && lastCommaIdx >= 0) {
          const lastArg = typeStr.slice(lastCommaIdx + 1, i).trim();
          return lastArg && /^\w+$/.test(lastArg) ? lastArg : undefined;
        }
        const inner = typeStr.slice(start, i).trim();
        const firstArg = extractFirstArg(inner);
        return firstArg && /^\w+$/.test(firstArg) ? firstArg : undefined;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      if (pos === 'first') {
        const arg = typeStr.slice(start, i).trim();
        return arg && /^\w+$/.test(arg) ? arg : undefined;
      }
      lastCommaIdx = i;
    }
  }

  return undefined;
}
