import type { SymbolDefinition } from '../../../../_shared/index.js';
import type { ResolveResult } from '../types.js';
import type { ResolutionTier } from '../../model/resolution-context.js';
declare const orderProviderSameNameTypeCandidates: (candidates: readonly SymbolDefinition[], typeName: string, filePath: string) => readonly SymbolDefinition[] | null;
export declare const resolveProviderPrimaryTypeCandidate: (candidates: readonly SymbolDefinition[], tier: ResolutionTier, typeName: string, filePath: string) => ResolveResult | null;
export { orderProviderSameNameTypeCandidates };
