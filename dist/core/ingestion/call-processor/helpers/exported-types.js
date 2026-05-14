import { MAX_EXPORTS_PER_FILE, MAX_TYPE_NAME_LENGTH } from '../constants.js';
import { extractReturnTypeName } from '../../type-extractors/shared.js';
export function buildImportedReturnTypes(filePath, namedImportMap, symbolTable) {
    const result = new Map();
    const fileImports = namedImportMap.get(filePath);
    if (!fileImports)
        return result;
    for (const [localName, binding] of fileImports) {
        const def = symbolTable.lookupExactFull(binding.sourcePath, binding.exportedName);
        if (!def?.returnType)
            continue;
        const simpleReturn = extractReturnTypeName(def.returnType);
        if (simpleReturn)
            result.set(localName, simpleReturn);
    }
    return result;
}
export function buildImportedRawReturnTypes(filePath, namedImportMap, symbolTable) {
    const result = new Map();
    const fileImports = namedImportMap.get(filePath);
    if (!fileImports)
        return result;
    for (const [localName, binding] of fileImports) {
        const def = symbolTable.lookupExactFull(binding.sourcePath, binding.exportedName);
        if (!def?.returnType)
            continue;
        result.set(localName, def.returnType);
    }
    return result;
}
export function collectExportedBindings(typeEnv, filePath, symbolTable, graph) {
    const fileScope = typeEnv.fileScope();
    if (!fileScope || fileScope.size === 0)
        return null;
    const exported = new Map();
    for (const [varName, typeName] of fileScope) {
        if (exported.size >= MAX_EXPORTS_PER_FILE)
            break;
        if (!typeName || typeName.length > MAX_TYPE_NAME_LENGTH)
            continue;
        const nodeId = symbolTable.lookupExact(filePath, varName);
        if (!nodeId)
            continue;
        const node = graph.getNode(nodeId);
        if (node?.properties?.isExported) {
            exported.set(varName, typeName);
        }
    }
    return exported.size > 0 ? exported : null;
}
export function buildExportedTypeMapFromGraph(graph, symbolTable) {
    const result = new Map();
    graph.forEachNode((node) => {
        if (!node.properties?.isExported)
            return;
        if (!node.properties?.filePath || !node.properties?.name)
            return;
        const filePath = node.properties.filePath;
        const name = node.properties.name;
        if (!name || name.length > MAX_TYPE_NAME_LENGTH)
            return;
        const defs = symbolTable.lookupExactAll(filePath, name);
        const def = defs.find((d) => d.nodeId === node.id) ?? defs[0];
        if (!def)
            return;
        const typeName = def.returnType ?? def.declaredType;
        if (!typeName || typeName.length > MAX_TYPE_NAME_LENGTH)
            return;
        const simpleType = extractReturnTypeName(typeName) ?? typeName;
        if (!simpleType)
            return;
        let fileExports = result.get(filePath);
        if (!fileExports) {
            fileExports = new Map();
            result.set(filePath, fileExports);
        }
        if (fileExports.size < MAX_EXPORTS_PER_FILE) {
            fileExports.set(name, simpleType);
        }
    });
    return result;
}
