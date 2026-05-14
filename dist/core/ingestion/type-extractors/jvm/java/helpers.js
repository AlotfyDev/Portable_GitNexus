import { extractSimpleTypeName, extractGenericTypeArgs, } from '../../shared.js';
/** Extract element type from a Java type annotation AST node.
 *  Handles generic_type (List<User>), array_type (User[]). */
export const extractJavaElementTypeFromTypeNode = (typeNode, pos = 'last') => {
    if (typeNode.type === 'generic_type') {
        const args = extractGenericTypeArgs(typeNode);
        if (args.length >= 1)
            return pos === 'first' ? args[0] : args[args.length - 1];
    }
    if (typeNode.type === 'array_type') {
        const elemNode = typeNode.firstNamedChild;
        if (elemNode)
            return extractSimpleTypeName(elemNode);
    }
    return undefined;
};
/** Walk up from a for-each to the enclosing method_declaration and search parameters. */
export const findJavaParamElementType = (iterableName, startNode, pos = 'last') => {
    let current = startNode.parent;
    while (current) {
        if (current.type === 'method_declaration' || current.type === 'constructor_declaration') {
            const paramsNode = current.childForFieldName('parameters');
            if (paramsNode) {
                for (let i = 0; i < paramsNode.namedChildCount; i++) {
                    const param = paramsNode.namedChild(i);
                    if (!param || param.type !== 'formal_parameter')
                        continue;
                    const nameNode = param.childForFieldName('name');
                    if (nameNode?.text !== iterableName)
                        continue;
                    const typeNode = param.childForFieldName('type');
                    if (typeNode)
                        return extractJavaElementTypeFromTypeNode(typeNode, pos);
                }
            }
            break;
        }
        current = current.parent;
    }
    return undefined;
};
