import type { ResolutionContext } from '../../model/resolution-context.js';
import type { ResolveResult, OverloadHints } from '../types.js';
export declare const resolveMemberCallByFile: (calledName: string, receiverTypeName: string, currentFile: string, ctx: ResolutionContext, argCount?: number, callForm?: "free" | "member" | "constructor", overloadHints?: OverloadHints, preComputedArgTypes?: (string | undefined)[]) => ResolveResult | null;
