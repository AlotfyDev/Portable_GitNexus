import type { SymbolDefinition } from '../../../../_shared/index.js';
import type { OverloadHints } from '../types.js';
declare const normalizeJvmTypeName: (name: string) => string;
declare const matchCandidatesByArgTypes: (candidates: SymbolDefinition[], argTypes: (string | undefined)[]) => SymbolDefinition | null;
declare const tryOverloadDisambiguation: (candidates: SymbolDefinition[], hints: OverloadHints) => SymbolDefinition | null;
export declare const disambiguateByOverloadOrArgTypes: (pool: SymbolDefinition[], overloadHints: OverloadHints | undefined, preComputedArgTypes: (string | undefined)[] | undefined) => SymbolDefinition | null;
export { matchCandidatesByArgTypes, tryOverloadDisambiguation, normalizeJvmTypeName };
