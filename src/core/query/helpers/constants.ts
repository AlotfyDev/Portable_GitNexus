export function isTestFilePath(filePath: string): boolean {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  return (
    p.includes('.test.') ||
    p.includes('.spec.') ||
    p.includes('__tests__/') ||
    p.includes('__mocks__/') ||
    p.includes('/test/') ||
    p.includes('/tests/') ||
    p.includes('/testing/') ||
    p.includes('/fixtures/') ||
    p.endsWith('_test.go') ||
    p.endsWith('_test.py') ||
    p.endsWith('_spec.rb') ||
    p.endsWith('_test.rb') ||
    p.includes('/spec/') ||
    p.includes('/test_') ||
    p.includes('/conftest.')
  );
}

export const VALID_NODE_LABELS = new Set([
  'File', 'Folder', 'Function', 'Class', 'Interface', 'Method',
  'CodeElement', 'Community', 'Process', 'Struct', 'Enum', 'Macro',
  'Typedef', 'Union', 'Namespace', 'Trait', 'Impl', 'TypeAlias',
  'Const', 'Static', 'Property', 'Record', 'Delegate', 'Annotation',
  'Constructor', 'Template', 'Module', 'Route', 'Tool',
]);

export const VALID_RELATION_TYPES = new Set([
  'CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'HAS_METHOD',
  'HAS_PROPERTY', 'METHOD_OVERRIDES', 'OVERRIDES', 'METHOD_IMPLEMENTS',
  'ACCESSES', 'HANDLES_ROUTE', 'FETCHES', 'HANDLES_TOOL',
  'ENTRY_POINT_OF', 'WRAPS',
]);

export const IMPACT_RELATION_CONFIDENCE: Readonly<Record<string, number>> = {
  CALLS: 0.9, IMPORTS: 0.9, EXTENDS: 0.85, IMPLEMENTS: 0.85,
  METHOD_OVERRIDES: 0.85, METHOD_IMPLEMENTS: 0.85, HAS_METHOD: 0.95,
  HAS_PROPERTY: 0.95, ACCESSES: 0.8, CONTAINS: 0.95,
};

export const confidenceForRelType = (relType: string | undefined): number =>
  IMPACT_RELATION_CONFIDENCE[relType ?? ''] ?? 0.5;

export const CYPHER_WRITE_RE =
  /(?<!:)\b(CREATE|DELETE|SET|MERGE|REMOVE|DROP|ALTER|COPY|DETACH|FOREACH|INSTALL|LOAD)\b/i;

export function isWriteQuery(query: string): boolean {
  return CYPHER_WRITE_RE.test(query);
}
