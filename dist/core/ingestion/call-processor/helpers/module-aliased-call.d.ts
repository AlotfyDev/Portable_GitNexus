import type { ExtractedCall } from '../../workers/parse-worker.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { WidenCache } from '../types.js';
import type { TieredCandidates } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';
export declare const resolveModuleAliasedCall: (call: Pick<ExtractedCall, "calledName" | "argCount" | "callForm" | "receiverName">, currentFile: string, ctx: ResolutionContext, widenCache?: WidenCache, tieredOverride?: TieredCandidates) => ResolveResult | null;
