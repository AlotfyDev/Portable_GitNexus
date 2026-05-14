import type { SymbolDefinition } from 'gitnexus-shared';
import type { OverloadHints } from '../types.js';
import type { TypeEnvironment } from '../../type-env.js';
import { extractCallArgTypes } from '../../utils/call-analysis.js';
import { KOTLIN_BOXED_TO_PRIMITIVE } from '../constants.js';

const normalizeJvmTypeName = (name: string): string => KOTLIN_BOXED_TO_PRIMITIVE[name] ?? name;

const matchCandidatesByArgTypes = (
  candidates: SymbolDefinition[],
  argTypes: (string | undefined)[],
): SymbolDefinition | null => {
  if (!candidates.some((c) => c.parameterTypes)) return null;

  const matched = candidates.filter((c) => {
    if (!c.parameterTypes) return true;
    return c.parameterTypes.every((pType, i) => {
      if (i >= argTypes.length || !argTypes[i]) return true;
      return normalizeJvmTypeName(pType) === argTypes[i];
    });
  });

  if (matched.length === 1) return matched[0];
  if (matched.length > 1) {
    const uniqueIds = new Set(matched.map((c) => c.nodeId));
    if (uniqueIds.size === 1) return matched[0];
  }
  return null;
};

const tryOverloadDisambiguation = (
  candidates: SymbolDefinition[],
  hints: OverloadHints,
): SymbolDefinition | null => {
  const argTypes = extractCallArgTypes(
    hints.callNode,
    hints.inferLiteralType,
    hints.typeEnv ? (varName: string, cn: any) => hints.typeEnv!.lookup(varName, cn) : undefined,
  );
  if (!argTypes) return null;
  return matchCandidatesByArgTypes(candidates, argTypes);
};

export const disambiguateByOverloadOrArgTypes = (
  pool: SymbolDefinition[],
  overloadHints: OverloadHints | undefined,
  preComputedArgTypes: (string | undefined)[] | undefined,
): SymbolDefinition | null => {
  if (!overloadHints && !preComputedArgTypes) return null;
  if (overloadHints) return tryOverloadDisambiguation(pool, overloadHints);
  if (preComputedArgTypes) return matchCandidatesByArgTypes(pool, preComputedArgTypes);
  return null;
};

export { matchCandidatesByArgTypes, tryOverloadDisambiguation, normalizeJvmTypeName };
