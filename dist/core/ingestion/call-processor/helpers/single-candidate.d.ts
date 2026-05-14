import type { TieredCandidates } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';
export declare const singleCandidate: (tiered: TieredCandidates, argCount?: number, callForm?: "free" | "member" | "constructor") => ResolveResult | null;
