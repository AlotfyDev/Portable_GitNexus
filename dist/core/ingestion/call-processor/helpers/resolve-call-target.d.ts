import type { ExtractedCall } from '../../workers/parse-worker.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { OverloadHints, WidenCache, ResolveResult } from '../types.js';
import type { HeritageMap } from '../../model/index.js';
import type { DispatchDecision } from '../../call-types.js';
/** @internal Exported for unit tests. */
export declare const _resolveCallTargetForTesting: (call: Pick<ExtractedCall, "calledName" | "argCount" | "callForm" | "receiverTypeName" | "receiverName">, currentFile: string, ctx: ResolutionContext, opts?: {
    overloadHints?: OverloadHints;
    widenCache?: WidenCache;
    preComputedArgTypes?: (string | undefined)[];
    heritageMap?: HeritageMap;
}) => ResolveResult | null;
export declare const resolveCallTarget: (call: Pick<ExtractedCall, "calledName" | "argCount" | "callForm" | "receiverTypeName" | "receiverName">, currentFile: string, ctx: ResolutionContext, overloadHints?: OverloadHints, widenCache?: WidenCache, preComputedArgTypes?: (string | undefined)[], heritageMap?: HeritageMap, dispatchDecision?: DispatchDecision) => ResolveResult | null;
/** Extract the bare function name from a sourceId. */
export declare const extractFuncNameFromSourceId: (sourceId: string) => string;
