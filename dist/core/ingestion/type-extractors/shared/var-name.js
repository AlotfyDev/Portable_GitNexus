export const extractVarName = (node) => {
    if (node.type === 'identifier' ||
        node.type === 'simple_identifier' ||
        node.type === 'variable_name' ||
        node.type === 'name' ||
        node.type === 'constant' ||
        node.type === 'property_identifier') {
        return node.text;
    }
    if (node.type === 'variable_declarator') {
        const nameChild = node.childForFieldName('name');
        if (nameChild)
            return extractVarName(nameChild);
    }
    if (node.type === 'mut_pattern') {
        const inner = node.firstNamedChild;
        if (inner)
            return extractVarName(inner);
    }
    if (node.type === 'pattern') {
        const inner = node.firstNamedChild;
        if (inner)
            return extractVarName(inner);
    }
    return undefined;
};
