import type { ResolveResult, OverloadHints } from '../types.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { TieredCandidates } from '../../model/resolution-context.js';
export declare const resolveStaticCall: (className: string, currentFile: string, ctx: ResolutionContext, argCount?: number, tieredOverride?: TieredCandidates, overloadHints?: OverloadHints, preComputedArgTypes?: (string | undefined)[]) => ResolveResult | null;
