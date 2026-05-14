import type { ResolveResult } from '../types.js';
import type { HeritageMap } from '../../model/index.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
export declare const resolveMemberCall: (ownerType: string, methodName: string, currentFile: string, ctx: ResolutionContext, heritageMap?: HeritageMap, argCount?: number, ancestryView?: "instance" | "singleton") => ResolveResult | null;
