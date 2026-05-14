import type { PositionIndex, ScopeTree } from '../../../../_shared/index.js';
import type { CaptureMatch } from '../../../../_shared/index.js';
import type { ScopeDraft, ScopeExtractorHooks } from '../types.js';
export declare function pass4CollectTypeBindings(matches: readonly CaptureMatch[], drafts: readonly ScopeDraft[], positionIndex: PositionIndex, filePath: string, provider: ScopeExtractorHooks, scopeTree: ScopeTree): void;
