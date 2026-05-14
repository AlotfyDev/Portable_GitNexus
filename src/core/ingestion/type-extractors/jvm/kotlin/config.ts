import { findChild, type SyntaxNode } from '../../../utils/ast-helpers.js';
import type {
  LanguageTypeConfig,
  ParameterExtractor,
  TypeBindingExtractor,
  InitializerExtractor,
  ClassNameLookup,
  ConstructorBindingScanner,
  ForLoopExtractor,
  PendingAssignmentExtractor,
  PatternBindingExtractor,
  ConstructorTypeDetector,
} from '../../types.js';
import {
  extractSimpleTypeName,
  extractVarName,
  resolveIterableElementType,
  methodToTypeArgPosition,
  extractElementTypeFromString,
  type TypeArgPosition,
} from '../../shared.js';
import {
  findKotlinConstructorCallee,
  extractKotlinElementTypeFromTypeNode,
  findKotlinParamElementType,
} from './helpers.js';
import { findAncestorByType, inferJvmLiteralType } from '../shared.js';

const KOTLIN_DECLARATION_NODE_TYPES: ReadonlySet<string> = new Set([
  'property_declaration',
  'variable_declaration',
]);

/** Kotlin: val x: Foo = ... */
const extractKotlinDeclaration: TypeBindingExtractor = (
  node: SyntaxNode,
  env: Map<string, string>,
): void => {
  if (node.type === 'property_declaration') {
    const varDecl = findChild(node, 'variable_declaration');
    if (varDecl) {
      const nameNode = findChild(varDecl, 'simple_identifier');
      const typeNode = findChild(varDecl, 'user_type') ?? findChild(varDecl, 'nullable_type');
      if (!nameNode || !typeNode) return;
      const varName = extractVarName(nameNode);
      const typeName = extractSimpleTypeName(typeNode);
      if (varName && typeName) env.set(varName, typeName);
      return;
    }
    const nameNode = node.childForFieldName('name') ?? findChild(node, 'simple_identifier');
    const typeNode = node.childForFieldName('type') ?? findChild(node, 'user_type');
    if (!nameNode || !typeNode) return;
    const varName = extractVarName(nameNode);
    const typeName = extractSimpleTypeName(typeNode);
    if (varName && typeName) env.set(varName, typeName);
  } else if (node.type === 'variable_declaration') {
    const nameNode = findChild(node, 'simple_identifier');
    const typeNode = findChild(node, 'user_type');
    if (nameNode && typeNode) {
      const varName = extractVarName(nameNode);
      const typeName = extractSimpleTypeName(typeNode);
      if (varName && typeName) env.set(varName, typeName);
    }
  }
};

/** Kotlin: parameter / formal_parameter -> type name */
const extractKotlinParameter: ParameterExtractor = (
  node: SyntaxNode,
  env: Map<string, string>,
): void => {
  let nameNode: SyntaxNode | null = null;
  let typeNode: SyntaxNode | null = null;

  if (node.type === 'formal_parameter') {
    typeNode = node.childForFieldName('type');
    nameNode = node.childForFieldName('name');
  } else {
    nameNode = node.childForFieldName('name') ?? node.childForFieldName('pattern');
    typeNode = node.childForFieldName('type');
  }

  if (!nameNode) nameNode = findChild(node, 'simple_identifier');
  if (!typeNode) typeNode = findChild(node, 'user_type') ?? findChild(node, 'nullable_type');

  if (!nameNode || !typeNode) return;
  const varName = extractVarName(nameNode);
  const typeName = extractSimpleTypeName(typeNode);
  if (varName && typeName) env.set(varName, typeName);
};

/** Kotlin: val user = User() */
const extractKotlinInitializer: InitializerExtractor = (
  node: SyntaxNode,
  env: Map<string, string>,
  classNames: ClassNameLookup,
): void => {
  const varDecl = findChild(node, 'variable_declaration');
  if (varDecl && findChild(varDecl, 'user_type')) return;

  const calleeName = findKotlinConstructorCallee(node, classNames);
  if (!calleeName) return;

  const nameNode = varDecl
    ? findChild(varDecl, 'simple_identifier')
    : findChild(node, 'simple_identifier');
  if (!nameNode) return;

  const varName = extractVarName(nameNode);
  if (varName) env.set(varName, calleeName);
};

/** Kotlin: detect constructor type from call_expression in typed declarations. */
const detectKotlinConstructorType: ConstructorTypeDetector = (node, classNames) => {
  return findKotlinConstructorCallee(node, classNames);
};

/** Kotlin: val x = User(...) */
const scanKotlinConstructorBinding: ConstructorBindingScanner = (node) => {
  if (node.type !== 'property_declaration') return undefined;
  const varDecl = findChild(node, 'variable_declaration');
  if (!varDecl) return undefined;
  if (findChild(varDecl, 'user_type')) return undefined;
  const callExpr = findChild(node, 'call_expression');
  if (!callExpr) return undefined;
  const callee = callExpr.firstNamedChild;
  if (!callee) return undefined;

  let calleeName: string | undefined;
  if (callee.type === 'simple_identifier') {
    calleeName = callee.text;
  } else if (callee.type === 'navigation_expression') {
    const suffix = callee.lastNamedChild;
    if (suffix?.type === 'navigation_suffix') {
      const methodName = suffix.lastNamedChild;
      if (methodName?.type === 'simple_identifier') {
        calleeName = methodName.text;
      }
    }
  }
  if (!calleeName) return undefined;
  const nameNode = findChild(varDecl, 'simple_identifier');
  if (!nameNode) return undefined;
  return { varName: nameNode.text, calleeName };
};

const KOTLIN_FOR_LOOP_NODE_TYPES: ReadonlySet<string> = new Set(['for_statement']);

/** Kotlin: for (user: User in users) */
const extractKotlinForLoopBinding: ForLoopExtractor = (node, ctx): void => {
  const { scopeEnv, declarationTypeNodes, scope, returnTypeLookup } = ctx;
  const varDecl = findChild(node, 'variable_declaration');
  if (!varDecl) return;
  const nameNode = findChild(varDecl, 'simple_identifier');
  if (!nameNode) return;
  const varName = extractVarName(nameNode);
  if (!varName) return;

  const typeNode = findChild(varDecl, 'user_type');
  if (typeNode) {
    const typeName = extractSimpleTypeName(typeNode);
    if (typeName) scopeEnv.set(varName, typeName);
    return;
  }

  let iterableName: string | undefined;
  let methodName: string | undefined;
  let fallbackIterableName: string | undefined;
  let callExprElementType: string | undefined;
  let foundVarDecl = false;
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child === varDecl) {
      foundVarDecl = true;
      continue;
    }
    if (!foundVarDecl || !child) continue;
    if (child.type === 'simple_identifier') {
      iterableName = child.text;
      break;
    }
    if (child.type === 'navigation_expression') {
      const obj = child.firstNamedChild;
      const suffix = findChild(child, 'navigation_suffix');
      const prop = suffix ? findChild(suffix, 'simple_identifier') : null;
      const hasCallSuffix = suffix ? findChild(suffix, 'call_suffix') !== null : false;
      if (obj?.type === 'simple_identifier') iterableName = obj.text;
      if (prop) methodName = prop.text;
      if (!hasCallSuffix && prop) {
        fallbackIterableName = prop.text;
      }
      break;
    }
    if (child.type === 'call_expression') {
      const callee = child.firstNamedChild;
      if (callee?.type === 'navigation_expression') {
        const obj = callee.firstNamedChild;
        if (obj?.type === 'simple_identifier') iterableName = obj.text;
        const suffix = findChild(callee, 'navigation_suffix');
        if (suffix) {
          const prop = findChild(suffix, 'simple_identifier');
          if (prop) methodName = prop.text;
        }
      } else if (callee?.type === 'simple_identifier') {
        const rawReturn = returnTypeLookup.lookupRawReturnType(callee.text);
        if (rawReturn) callExprElementType = extractElementTypeFromString(rawReturn);
      }
      break;
    }
  }
  if (!iterableName && !callExprElementType) return;

  let elementType: string | undefined;
  if (callExprElementType) {
    elementType = callExprElementType;
  } else {
    let containerTypeName = scopeEnv.get(iterableName!);
    if (!containerTypeName && fallbackIterableName) {
      iterableName = fallbackIterableName;
      methodName = undefined;
      containerTypeName = scopeEnv.get(iterableName);
    }
    const typeArgPos = methodToTypeArgPosition(methodName, containerTypeName);
    elementType = resolveIterableElementType(
      iterableName!,
      node,
      scopeEnv,
      declarationTypeNodes,
      scope,
      extractKotlinElementTypeFromTypeNode,
      findKotlinParamElementType,
      typeArgPos,
    );
  }
  if (elementType) scopeEnv.set(varName, elementType);
};

/** Kotlin: val alias = u */
const extractKotlinPendingAssignment: PendingAssignmentExtractor = (node, scopeEnv) => {
  if (node.type === 'property_declaration') {
    const varDecl = findChild(node, 'variable_declaration');
    if (!varDecl) return undefined;
    const nameNode = varDecl.firstNamedChild;
    if (!nameNode || nameNode.type !== 'simple_identifier') return undefined;
    const lhs = nameNode.text;
    if (scopeEnv.has(lhs)) return undefined;
    let foundEq = false;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === '=') {
        foundEq = true;
        continue;
      }
      if (foundEq && child.type === 'simple_identifier') {
        return { kind: 'copy', lhs, rhs: child.text };
      }
      if (foundEq && child.type === 'navigation_expression') {
        const recv = child.firstNamedChild;
        const suffix = child.lastNamedChild;
        const fieldNode = suffix?.type === 'navigation_suffix' ? suffix.lastNamedChild : suffix;
        if (recv?.type === 'simple_identifier' && fieldNode?.type === 'simple_identifier') {
          return { kind: 'fieldAccess', lhs, receiver: recv.text, field: fieldNode.text };
        }
      }
      if (foundEq && child.type === 'call_expression') {
        const calleeNode = child.firstNamedChild;
        if (calleeNode?.type === 'simple_identifier') {
          return { kind: 'callResult', lhs, callee: calleeNode.text };
        }
        if (calleeNode?.type === 'navigation_expression') {
          const recv = calleeNode.firstNamedChild;
          const suffix = calleeNode.lastNamedChild;
          const methodNode = suffix?.type === 'navigation_suffix' ? suffix.lastNamedChild : suffix;
          if (recv?.type === 'simple_identifier' && methodNode?.type === 'simple_identifier') {
            return { kind: 'methodCallResult', lhs, receiver: recv.text, method: methodNode.text };
          }
        }
      }
    }
    return undefined;
  }

  if (node.type === 'variable_declaration') {
    const nameNode = findChild(node, 'simple_identifier');
    if (!nameNode) return undefined;
    const lhs = nameNode.text;
    if (scopeEnv.has(lhs)) return undefined;
    const parent = node.parent;
    if (!parent) return undefined;
    let foundEq = false;
    for (let i = 0; i < parent.childCount; i++) {
      const child = parent.child(i);
      if (!child) continue;
      if (child.type === '=') {
        foundEq = true;
        continue;
      }
      if (foundEq && child.type === 'simple_identifier') {
        return { kind: 'copy', lhs, rhs: child.text };
      }
      if (foundEq && child.type === 'navigation_expression') {
        const recv = child.firstNamedChild;
        const suffix = child.lastNamedChild;
        const fieldNode = suffix?.type === 'navigation_suffix' ? suffix.lastNamedChild : suffix;
        if (recv?.type === 'simple_identifier' && fieldNode?.type === 'simple_identifier') {
          return { kind: 'fieldAccess', lhs, receiver: recv.text, field: fieldNode.text };
        }
      }
      if (foundEq && child.type === 'call_expression') {
        const calleeNode = child.firstNamedChild;
        if (calleeNode?.type === 'simple_identifier') {
          return { kind: 'callResult', lhs, callee: calleeNode.text };
        }
        if (calleeNode?.type === 'navigation_expression') {
          const recv = calleeNode.firstNamedChild;
          const suffix = calleeNode.lastNamedChild;
          const methodNode = suffix?.type === 'navigation_suffix' ? suffix.lastNamedChild : suffix;
          if (recv?.type === 'simple_identifier' && methodNode?.type === 'simple_identifier') {
            return { kind: 'methodCallResult', lhs, receiver: recv.text, method: methodNode.text };
          }
        }
      }
    }
    return undefined;
  }

  return undefined;
};

/** Kotlin when/is smart casts + null-check narrowing */
const extractKotlinPatternBinding: PatternBindingExtractor = (
  node,
  scopeEnv,
  declarationTypeNodes,
  scope,
) => {
  if (node.type === 'type_test') {
    const typeNode = node.lastNamedChild;
    if (!typeNode) return undefined;
    const typeName = extractSimpleTypeName(typeNode);
    if (!typeName) return undefined;
    const whenExpr = findAncestorByType(node, 'when_expression');
    if (!whenExpr) return undefined;
    const whenSubject = whenExpr.namedChild(0);
    const subject = whenSubject?.firstNamedChild ?? whenSubject;
    if (!subject) return undefined;
    const varName = extractVarName(subject);
    if (!varName) return undefined;
    return { varName, typeName };
  }

  if (node.type === 'equality_expression') {
    const op = node.children.find((c) => !c.isNamed && c.text === '!=');
    if (!op) return undefined;

    let varNode: SyntaxNode | undefined;
    let hasNull = false;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (!c) continue;
      if (c.type === 'simple_identifier') varNode = c;
      if (!c.isNamed && c.text === 'null') hasNull = true;
    }
    if (!varNode || !hasNull) return undefined;

    const varName = varNode.text;
    const resolvedType = scopeEnv.get(varName);
    if (!resolvedType) return undefined;

    const declTypeNode = declarationTypeNodes.get(`${scope}\0${varName}`);
    if (!declTypeNode) return undefined;
    const declText = declTypeNode.text;
    if (!declText.includes('?') && !declText.includes('null')) return undefined;

    const ifExpr = findAncestorByType(node, 'if_expression');
    if (!ifExpr) return undefined;
    for (let i = 0; i < ifExpr.childCount; i++) {
      const child = ifExpr.child(i);
      if (child?.type === 'control_structure_body') {
        return {
          varName,
          typeName: resolvedType,
          narrowingRange: { startIndex: child.startIndex, endIndex: child.endIndex },
        };
      }
    }
    return undefined;
  }

  return undefined;
};

export const kotlinTypeConfig: LanguageTypeConfig = {
  allowPatternBindingOverwrite: true,
  declarationNodeTypes: KOTLIN_DECLARATION_NODE_TYPES,
  getDeclarationTypeNode: (node) => {
    const varDecl =
      node.type === 'property_declaration' ? findChild(node, 'variable_declaration') : node;
    if (varDecl) {
      return (
        varDecl.childForFieldName('type') ??
        findChild(varDecl, 'user_type') ??
        findChild(varDecl, 'nullable_type')
      );
    }
    return node.childForFieldName('type') ?? findChild(node, 'user_type') ?? null;
  },
  forLoopNodeTypes: KOTLIN_FOR_LOOP_NODE_TYPES,
  patternBindingNodeTypes: new Set(['type_test', 'equality_expression']),
  extractDeclaration: extractKotlinDeclaration,
  extractParameter: extractKotlinParameter,
  extractInitializer: extractKotlinInitializer,
  scanConstructorBinding: scanKotlinConstructorBinding,
  extractForLoopBinding: extractKotlinForLoopBinding,
  extractPendingAssignment: extractKotlinPendingAssignment,
  extractPatternBinding: extractKotlinPatternBinding,
  inferLiteralType: inferJvmLiteralType,
  detectConstructorType: detectKotlinConstructorType,
};
