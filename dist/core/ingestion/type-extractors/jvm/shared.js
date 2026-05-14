/** Walk up from a node to find an ancestor of a given type. */
export const findAncestorByType = (node, type) => {
    let current = node.parent;
    while (current) {
        if (current.type === type)
            return current;
        current = current.parent;
    }
    return undefined;
};
/** Infer the type of a literal AST node for Java/Kotlin overload disambiguation. */
export const inferJvmLiteralType = (node) => {
    switch (node.type) {
        case 'decimal_integer_literal':
        case 'integer_literal':
        case 'hex_integer_literal':
        case 'octal_integer_literal':
        case 'binary_integer_literal':
            if (node.text.endsWith('L') || node.text.endsWith('l'))
                return 'long';
            return 'int';
        case 'decimal_floating_point_literal':
        case 'real_literal':
            if (node.text.endsWith('f') || node.text.endsWith('F'))
                return 'float';
            return 'double';
        case 'string_literal':
        case 'line_string_literal':
        case 'multi_line_string_literal':
            return 'String';
        case 'character_literal':
            return 'char';
        case 'true':
        case 'false':
        case 'boolean_literal':
            return 'boolean';
        case 'null_literal':
            return 'null';
        default:
            return undefined;
    }
};
