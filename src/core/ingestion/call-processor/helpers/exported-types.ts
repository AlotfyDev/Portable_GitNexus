import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ExportedTypeMap } from '../types.js';
import type { SymbolTableReader } from '../../model/index.js';
import { MAX_EXPORTS_PER_FILE, MAX_TYPE_NAME_LENGTH } from '../constants.js';
import { extractReturnTypeName } from '../../type-extractors/shared.js';

export function buildImportedReturnTypes(
  filePath: string,
  namedImportMap: ReadonlyMap<
    string,
    ReadonlyMap<string, { sourcePath: string; exportedName: string }>
  >,
  symbolTable: {
    lookupExactFull(filePath: string, name: string): { returnType?: string } | undefined;
  },
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const fileImports = namedImportMap.get(filePath);
  if (!fileImports) return result;

  for (const [localName, binding] of fileImports) {
    const def = symbolTable.lookupExactFull(binding.sourcePath, binding.exportedName);
    if (!def?.returnType) continue;
    const simpleReturn = extractReturnTypeName(def.returnType);
    if (simpleReturn) result.set(localName, simpleReturn);
  }
  return result;
}

export function buildImportedRawReturnTypes(
  filePath: string,
  namedImportMap: ReadonlyMap<
    string,
    ReadonlyMap<string, { sourcePath: string; exportedName: string }>
  >,
  symbolTable: {
    lookupExactFull(filePath: string, name: string): { returnType?: string } | undefined;
  },
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const fileImports = namedImportMap.get(filePath);
  if (!fileImports) return result;

  for (const [localName, binding] of fileImports) {
    const def = symbolTable.lookupExactFull(binding.sourcePath, binding.exportedName);
    if (!def?.returnType) continue;
    result.set(localName, def.returnType);
  }
  return result;
}

export function collectExportedBindings(
  typeEnv: { fileScope(): ReadonlyMap<string, string> },
  filePath: string,
  symbolTable: { lookupExact(filePath: string, name: string): string | undefined },
  graph: { getNode(id: string): { properties?: { isExported?: boolean } } | undefined },
): Map<string, string> | null {
  const fileScope = typeEnv.fileScope();
  if (!fileScope || fileScope.size === 0) return null;

  const exported = new Map<string, string>();
  for (const [varName, typeName] of fileScope) {
    if (exported.size >= MAX_EXPORTS_PER_FILE) break;
    if (!typeName || typeName.length > MAX_TYPE_NAME_LENGTH) continue;
    const nodeId = symbolTable.lookupExact(filePath, varName);
    if (!nodeId) continue;
    const node = graph.getNode(nodeId);
    if (node?.properties?.isExported) {
      exported.set(varName, typeName);
    }
  }
  return exported.size > 0 ? exported : null;
}

export function buildExportedTypeMapFromGraph(
  graph: KnowledgeGraph,
  symbolTable: SymbolTableReader,
): ExportedTypeMap {
  const result: ExportedTypeMap = new Map();
  graph.forEachNode((node) => {
    if (!node.properties?.isExported) return;
    if (!node.properties?.filePath || !node.properties?.name) return;
    const filePath = node.properties.filePath as string;
    const name = node.properties.name as string;
    if (!name || name.length > MAX_TYPE_NAME_LENGTH) return;
    const defs = symbolTable.lookupExactAll(filePath, name);
    const def = defs.find((d) => d.nodeId === node.id) ?? defs[0];
    if (!def) return;
    const typeName = def.returnType ?? def.declaredType;
    if (!typeName || typeName.length > MAX_TYPE_NAME_LENGTH) return;
    const simpleType = extractReturnTypeName(typeName) ?? typeName;
    if (!simpleType) return;
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
