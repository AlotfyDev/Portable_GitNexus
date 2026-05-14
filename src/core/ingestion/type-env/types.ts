import type { SyntaxNode } from '../utils/ast-helpers.js';
import type { BindingAccumulator, BindingEntry } from '../binding-accumulator.js';
import type { SemanticModel } from '../model/index.js';
import type { NodeLabel } from 'gitnexus-shared';

export type TypeEnv = Map<string, Map<string, string>>;

export interface PatternOverride {
  rangeStart: number;
  rangeEnd: number;
  typeName: string;
}

export type PatternOverrides = Map<string, Map<string, PatternOverride[]>>;

export interface TypeEnvironment {
  lookup(varName: string, callNode: SyntaxNode): string | undefined;
  readonly constructorBindings: readonly ConstructorBinding[];
  fileScope(): ReadonlyMap<string, string>;
  allScopes(): ReadonlyMap<string, ReadonlyMap<string, string>>;
  readonly constructorTypeMap: ReadonlyMap<string, string>;
  flush(filePath: string, accumulator: BindingAccumulator): void;
}

export interface BuildTypeEnvOptions {
  model?: SemanticModel;
  parentMap?: ReadonlyMap<string, readonly string[]>;
  importedBindings?: ReadonlyMap<string, string>;
  importedReturnTypes?: ReadonlyMap<string, string>;
  importedRawReturnTypes?: ReadonlyMap<string, string>;
  enclosingFunctionFinder?: (ancestorNode: SyntaxNode) => { funcName: string; label: NodeLabel } | null;
  extractFunctionName?: (node: SyntaxNode) => { funcName: string | null; label: NodeLabel } | null;
}

export interface ConstructorBinding {
  scope: string;
  varName: string;
  calleeName: string;
  receiverClassName?: string;
}

export type ClassDefRef = { nodeId: string; type: string; filePath: string };
