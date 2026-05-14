import type { HeritageMap } from '../../model/index.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';
export declare function findInterfaceDispatchTargets(calledName: string, receiverTypeName: string, currentFile: string, ctx: ResolutionContext, heritageMap: HeritageMap, primaryNodeId: string): ResolveResult[];
