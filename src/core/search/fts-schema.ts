export interface FTSIndexDefinition {
  readonly table: string;
  readonly indexName: string;
  readonly properties: readonly string[];
}

export const FTS_INDEXES: readonly FTSIndexDefinition[] = [
  { table: 'File', indexName: 'file_fts', properties: ['name', 'content'] },
  { table: 'Function', indexName: 'function_fts', properties: ['name', 'content'] },
  { table: 'Class', indexName: 'class_fts', properties: ['name', 'content'] },
  { table: 'Method', indexName: 'method_fts', properties: ['name', 'content'] },
  { table: 'Interface', indexName: 'interface_fts', properties: ['name', 'content'] },
  { table: 'CodeElement', indexName: 'codeelement_fts', properties: ['name', 'content'] },
  { table: 'Section', indexName: 'section_fts', properties: ['name', 'content'] },
  { table: 'Struct', indexName: 'struct_fts', properties: ['name', 'content'] },
  { table: 'Enum', indexName: 'enum_fts', properties: ['name', 'content'] },
  { table: 'Macro', indexName: 'macro_fts', properties: ['name', 'content'] },
  { table: 'Typedef', indexName: 'typedef_fts', properties: ['name', 'content'] },
  { table: 'Union', indexName: 'union_fts', properties: ['name', 'content'] },
  { table: 'Namespace', indexName: 'namespace_fts', properties: ['name', 'content'] },
  { table: 'Trait', indexName: 'trait_fts', properties: ['name', 'content'] },
  { table: 'Impl', indexName: 'impl_fts', properties: ['name', 'content'] },
  { table: 'TypeAlias', indexName: 'typealias_fts', properties: ['name', 'content'] },
  { table: 'Const', indexName: 'const_fts', properties: ['name', 'content'] },
  { table: 'Static', indexName: 'static_fts', properties: ['name', 'content'] },
  { table: 'Variable', indexName: 'variable_fts', properties: ['name', 'content'] },
  { table: 'Property', indexName: 'property_fts', properties: ['name', 'content'] },
  { table: 'Record', indexName: 'record_fts', properties: ['name', 'content'] },
  { table: 'Delegate', indexName: 'delegate_fts', properties: ['name', 'content'] },
  { table: 'Annotation', indexName: 'annotation_fts', properties: ['name', 'content'] },
  { table: 'Constructor', indexName: 'constructor_fts', properties: ['name', 'content'] },
  { table: 'Template', indexName: 'template_fts', properties: ['name', 'content'] },
  { table: 'Module', indexName: 'module_fts', properties: ['name', 'content'] },
];
