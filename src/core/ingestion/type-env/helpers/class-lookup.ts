import {
  type SyntaxNode,
  CLASS_CONTAINER_TYPES,
  FUNCTION_NODE_TYPES,
} from '../../utils/ast-helpers.js';
import { CALL_EXPRESSION_TYPES } from '../../utils/call-analysis.js';
import { extractSimpleTypeName } from '../../type-extractors/shared.js';
import type { SemanticModel } from '../../model/index.js';
import type { ClassNameLookup } from '../../type-extractors/types.js';
import { CLASS_LIKE_TYPES, CONSTRUCTOR_EXPR_TYPES } from '../constants.js';
import type { ClassDefRef } from '../types.js';

const enclosingClassNameCache = new Map<SyntaxNode, string | undefined>();
const enclosingParentClassNameCache = new Map<SyntaxNode, string | undefined>();

export const clearClassNameCaches = (): void => {
  enclosingClassNameCache.clear();
  enclosingParentClassNameCache.clear();
};

export const findTypeIdentifierChild = (node: SyntaxNode): SyntaxNode | null => {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'type_identifier') return child;
  }
  return null;
};

export const findEnclosingClassName = (node: SyntaxNode): string | undefined => {
  if (enclosingClassNameCache.has(node)) return enclosingClassNameCache.get(node);
  let current = node.parent;
  while (current) {
    if (CLASS_CONTAINER_TYPES.has(current.type)) {
      const nameNode = current.childForFieldName('name') ?? findTypeIdentifierChild(current);
      if (nameNode) {
        enclosingClassNameCache.set(node, nameNode.text);
        return nameNode.text;
      }
    }
    current = current.parent;
  }
  enclosingClassNameCache.set(node, undefined);
  return undefined;
};

export const findEnclosingParentClassName = (node: SyntaxNode): string | undefined => {
  if (enclosingParentClassNameCache.has(node)) return enclosingParentClassNameCache.get(node);
  let current = node.parent;
  while (current) {
    if (CLASS_CONTAINER_TYPES.has(current.type)) {
      const result = extractParentClassFromNode(current);
      enclosingParentClassNameCache.set(node, result);
      return result;
    }
    current = current.parent;
  }
  enclosingParentClassNameCache.set(node, undefined);
  return undefined;
};

const extractParentClassFromNode = (classNode: SyntaxNode): string | undefined => {
  const superclassNode = classNode.childForFieldName('superclass');
  if (superclassNode) {
    const inner =
      superclassNode.childForFieldName('type') ?? superclassNode.firstNamedChild ?? superclassNode;
    return extractSimpleTypeName(inner) ?? inner.text;
  }

  const superclassesNode = classNode.childForFieldName('superclasses');
  if (superclassesNode) {
    const first = superclassesNode.firstNamedChild;
    if (first) return extractSimpleTypeName(first) ?? first.text;
  }

  for (let i = 0; i < classNode.childCount; i++) {
    const child = classNode.child(i);
    if (!child) continue;

    switch (child.type) {
      case 'class_heritage': {
        for (let j = 0; j < child.childCount; j++) {
          const clause = child.child(j);
          if (clause?.type === 'extends_clause') {
            const typeNode = clause.firstNamedChild;
            if (typeNode) return extractSimpleTypeName(typeNode) ?? typeNode.text;
          }
          if (clause?.type === 'identifier' || clause?.type === 'type_identifier') {
            return clause.text;
          }
        }
        break;
      }

      case 'base_list': {
        const first = child.firstNamedChild;
        if (first) {
          if (first.type === 'generic_name') {
            const inner = first.childForFieldName('name') ?? first.firstNamedChild;
            if (inner) return inner.text;
          }
          return first.text;
        }
        break;
      }

      case 'base_clause': {
        const name = child.firstNamedChild;
        if (name) return name.text;
        break;
      }

      case 'base_class_clause': {
        for (let j = 0; j < child.childCount; j++) {
          const inner = child.child(j);
          if (inner?.type === 'type_identifier') return inner.text;
        }
        break;
      }

      case 'delegation_specifier': {
        const delegate = child.firstNamedChild;
        if (delegate?.type === 'constructor_invocation') {
          const userType = delegate.firstNamedChild;
          if (userType?.type === 'user_type') {
            const typeId = userType.firstNamedChild;
            if (typeId) return typeId.text;
          }
        }
        if (delegate?.type === 'user_type') {
          const typeId = delegate.firstNamedChild;
          if (typeId) return typeId.text;
        }
        break;
      }

      case 'inheritance_specifier': {
        const userType = child.childForFieldName('inherits_from') ?? child.firstNamedChild;
        if (userType?.type === 'user_type') {
          const typeId = userType.firstNamedChild;
          if (typeId) return typeId.text;
        }
        break;
      }
    }
  }

  return undefined;
};

export const createClassNameLookup = (localNames: Set<string>, model?: SemanticModel): ClassNameLookup => {
  if (!model) return localNames as ClassNameLookup;

  const memo = new Map<string, boolean>();
  return {
    has(name: string): boolean {
      if (localNames.has(name)) return true;
      const cached = memo.get(name);
      if (cached !== undefined) return cached;
      const result = model.types
        .lookupClassByName(name)
        .some((def) => def.type === 'Class' || def.type === 'Enum' || def.type === 'Struct');
      memo.set(name, result);
      return result;
    },
  };
};

export const lookupClassDefsByName = (
  model: SemanticModel,
  name: string,
  allowedTypes: ReadonlySet<string> = CLASS_LIKE_TYPES,
): ClassDefRef[] => model.types.lookupClassByName(name).filter((d) => allowedTypes.has(d.type));

export const createClassDefCache = (model?: SemanticModel) => {
  const cache = new Map<string, ClassDefRef[]>();
  return (typeName: string) => {
    let result = cache.get(typeName);
    if (result === undefined) {
      result = model ? lookupClassDefsByName(model, typeName) : [];
      cache.set(typeName, result);
    }
    return result;
  };
};

export const extractConstructorTypeName = (node: SyntaxNode, depth = 0): string | undefined => {
  if (depth > 5) return undefined;
  if (CONSTRUCTOR_EXPR_TYPES.has(node.type)) {
    const typeField = node.childForFieldName('type');
    if (typeField) return extractSimpleTypeName(typeField);
    const ctorField = node.childForFieldName('constructor');
    if (ctorField) return extractSimpleTypeName(ctorField);
    if (node.firstNamedChild) return extractSimpleTypeName(node.firstNamedChild);
  }
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (!child) continue;
    if (
      FUNCTION_NODE_TYPES.has(child.type) ||
      CLASS_CONTAINER_TYPES.has(child.type) ||
      CALL_EXPRESSION_TYPES.has(child.type)
    )
      continue;
    const result = extractConstructorTypeName(child, depth + 1);
    if (result) return result;
  }
  return undefined;
};
