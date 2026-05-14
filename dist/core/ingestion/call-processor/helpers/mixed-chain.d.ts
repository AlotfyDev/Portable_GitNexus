import type { MixedChainStep } from '../../utils/call-analysis.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { HeritageMap } from '../../model/index.js';
import type { OnFieldResolved } from '../types.js';
export declare const walkMixedChain: (chain: MixedChainStep[], startType: string, filePath: string, ctx: ResolutionContext, onFieldResolved?: OnFieldResolved, heritageMap?: HeritageMap) => string | undefined;
