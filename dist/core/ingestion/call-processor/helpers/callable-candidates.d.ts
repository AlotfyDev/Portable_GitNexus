import type { SymbolDefinition } from '../../../../_shared/index.js';
import { type ResolutionTier } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';
export declare const filterCallableCandidates: (candidates: readonly SymbolDefinition[], argCount?: number, callForm?: "free" | "member" | "constructor") => SymbolDefinition[];
/**
 * Count callable candidates matching the kind + arity filter without
 * allocating an intermediate array. Short-circuits once count exceeds `threshold`.
 */
export declare const countCallableCandidates: (candidates: readonly SymbolDefinition[], argCount?: number, callForm?: "free" | "member" | "constructor", threshold?: number) => number;
export declare const toResolveResult: (definition: SymbolDefinition, tier: ResolutionTier) => ResolveResult;
