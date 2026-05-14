import type { MixedChainStep } from '../../utils/call-analysis.js';
import type { SupportedLanguages, NodeLabel, ParsedFile } from 'gitnexus-shared';
import type { NamedBinding } from '../../named-bindings/types.js';
import type { ExtractedHeritage } from '../../model/heritage-map.js';
import type { ConstructorBinding } from '../../type-env.js';

export interface ParsedNode {
  id: string;
  label: string;
  properties: {
    name: string;
    filePath: string;
    startLine: number;
    endLine: number;
    language: SupportedLanguages;
    isExported: boolean;
    astFrameworkMultiplier?: number;
    astFrameworkReason?: string;
    description?: string;
    [key: string]: unknown;
  };
}

export interface ParsedRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'DEFINES' | 'HAS_METHOD' | 'HAS_PROPERTY';
  confidence: number;
  reason: string;
}

export interface ParsedSymbol {
  filePath: string;
  name: string;
  nodeId: string;
  type: NodeLabel;
  qualifiedName?: string;
  parameterCount?: number;
  requiredParameterCount?: number;
  parameterTypes?: string[];
  returnType?: string;
  declaredType?: string;
  ownerId?: string;
  visibility?: string;
  isStatic?: boolean;
  isReadonly?: boolean;
  isAbstract?: boolean;
  isFinal?: boolean;
  annotations?: string[];
}

export interface ExtractedImport {
  filePath: string;
  rawImportPath: string;
  language: SupportedLanguages;
  namedBindings?: NamedBinding[];
}

export interface ExtractedCall {
  filePath: string;
  calledName: string;
  sourceId: string;
  argCount?: number;
  callForm?: 'free' | 'member' | 'constructor';
  receiverName?: string;
  receiverTypeName?: string;
  receiverMixedChain?: MixedChainStep[];
  argTypes?: (string | undefined)[];
}

export interface ExtractedAssignment {
  filePath: string;
  sourceId: string;
  receiverText: string;
  propertyName: string;
  receiverTypeName?: string;
}

export interface ExtractedRoute {
  filePath: string;
  httpMethod: string;
  routePath: string | null;
  controllerName: string | null;
  methodName: string | null;
  middleware: string[];
  prefix: string | null;
  lineNumber: number;
}

export interface ExtractedFetchCall {
  filePath: string;
  fetchURL: string;
  lineNumber: number;
}

export interface ExtractedDecoratorRoute {
  filePath: string;
  routePath: string;
  httpMethod: string;
  decoratorName: string;
  lineNumber: number;
}

export interface ExtractedToolDef {
  filePath: string;
  toolName: string;
  description: string;
  lineNumber: number;
  handlerNodeId?: string;
}

export interface ExtractedORMQuery {
  filePath: string;
  orm: 'prisma' | 'supabase';
  model: string;
  method: string;
  lineNumber: number;
}

export interface FileConstructorBindings {
  filePath: string;
  bindings: ConstructorBinding[];
}

export interface FileScopeBindings {
  filePath: string;
  bindings: [string, string][];
}

export interface ParseWorkerResult {
  nodes: ParsedNode[];
  relationships: ParsedRelationship[];
  symbols: ParsedSymbol[];
  imports: ExtractedImport[];
  calls: ExtractedCall[];
  assignments: ExtractedAssignment[];
  heritage: ExtractedHeritage[];
  routes: ExtractedRoute[];
  fetchCalls: ExtractedFetchCall[];
  decoratorRoutes: ExtractedDecoratorRoute[];
  toolDefs: ExtractedToolDef[];
  ormQueries: ExtractedORMQuery[];
  constructorBindings: FileConstructorBindings[];
  fileScopeBindings: FileScopeBindings[];
  parsedFiles: ParsedFile[];
  skippedLanguages: Record<string, number>;
  fileCount: number;
}

export interface ParseWorkerInput {
  path: string;
  content: string;
}

export type WorkerIncomingMessage =
  | { type: 'sub-batch'; files: ParseWorkerInput[] }
  | { type: 'flush' }
  | ParseWorkerInput[];
