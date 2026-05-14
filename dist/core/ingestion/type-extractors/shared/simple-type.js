import { NULLABLE_WRAPPER_TYPES } from './constants.js';
import { extractGenericTypeArgs } from './generics.js';
export const extractSimpleTypeName = (typeNode, depth = 0) => {
    if (depth > 50 || typeNode.text.length > 2048)
        return undefined;
    if (typeNode.type === 'type_identifier' ||
        typeNode.type === 'identifier' ||
        typeNode.type === 'simple_identifier' ||
        typeNode.type === 'constant') {
        return typeNode.text;
    }
    if (typeNode.type === 'scoped_identifier' ||
        typeNode.type === 'qualified_identifier' ||
        typeNode.type === 'scoped_type_identifier' ||
        typeNode.type === 'qualified_name' ||
        typeNode.type === 'qualified_type' ||
        typeNode.type === 'member_expression' ||
        typeNode.type === 'member_access_expression' ||
        typeNode.type === 'attribute' ||
        typeNode.type === 'scope_resolution' ||
        typeNode.type === 'selector_expression') {
        const last = typeNode.lastNamedChild;
        if (last &&
            (last.type === 'type_identifier' ||
                last.type === 'identifier' ||
                last.type === 'simple_identifier' ||
                last.type === 'name' ||
                last.type === 'constant' ||
                last.type === 'property_identifier' ||
                last.type === 'field_identifier')) {
            return last.text;
        }
    }
    if (typeNode.type === 'template_type') {
        const base = typeNode.childForFieldName('name') ?? typeNode.firstNamedChild;
        if (base)
            return extractSimpleTypeName(base, depth + 1);
    }
    if (typeNode.type === 'generic_type' ||
        typeNode.type === 'parameterized_type' ||
        typeNode.type === 'generic_name') {
        const base = typeNode.childForFieldName('name') ??
            typeNode.childForFieldName('type') ??
            typeNode.firstNamedChild;
        if (!base)
            return undefined;
        const baseName = extractSimpleTypeName(base, depth + 1);
        if (baseName && NULLABLE_WRAPPER_TYPES.has(baseName)) {
            const args = extractGenericTypeArgs(typeNode);
            if (args.length >= 1)
                return args[0];
        }
        return baseName;
    }
    if (typeNode.type === 'nullable_type') {
        const inner = typeNode.firstNamedChild;
        if (inner)
            return extractSimpleTypeName(inner, depth + 1);
    }
    if (typeNode.type === 'union_type') {
        const nonNullTypes = [];
        for (let i = 0; i < typeNode.namedChildCount; i++) {
            const child = typeNode.namedChild(i);
            if (!child)
                continue;
            const text = child.text;
            if (text === 'null' || text === 'undefined' || text === 'void')
                continue;
            nonNullTypes.push(child);
        }
        if (nonNullTypes.length === 1) {
            return extractSimpleTypeName(nonNullTypes[0], depth + 1);
        }
    }
    if (typeNode.type === 'type_annotation' ||
        typeNode.type === 'type' ||
        typeNode.type === 'user_type') {
        const inner = typeNode.firstNamedChild;
        if (inner)
            return extractSimpleTypeName(inner, depth + 1);
    }
    if (typeNode.type === 'pointer_type' || typeNode.type === 'reference_type') {
        for (let i = 0; i < typeNode.namedChildCount; i++) {
            const child = typeNode.namedChild(i);
            if (child && child.type !== 'mutable_specifier') {
                return extractSimpleTypeName(child, depth + 1);
            }
        }
    }
    if (typeNode.type === 'primitive_type' ||
        typeNode.type === 'predefined_type' ||
        typeNode.type === 'integral_type' ||
        typeNode.type === 'floating_point_type' ||
        typeNode.type === 'boolean_type' ||
        typeNode.type === 'void_type') {
        return typeNode.text;
    }
    if (typeNode.type === 'named_type' || typeNode.type === 'optional_type') {
        const inner = typeNode.childForFieldName('name') ?? typeNode.firstNamedChild;
        if (inner)
            return extractSimpleTypeName(inner, depth + 1);
    }
    if (typeNode.type === 'name') {
        return typeNode.text;
    }
    return undefined;
};
