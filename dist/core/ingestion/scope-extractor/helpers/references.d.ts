import type { PositionIndex, ScopeTree } from '../../../../_shared/index.js';
import type { CaptureMatch, ReferenceSite } from '../../../../_shared/index.js';
import type { ScopeExtractorHooks } from '../types.js';
export declare function pass5CollectReferences(matches: readonly CaptureMatch[], positionIndex: PositionIndex, filePath: string, referenceSites: ReferenceSite[], provider: ScopeExtractorHooks, scopeTree: ScopeTree): void;
