import type { CaptureMatch, Scope } from '../../../../_shared/index.js';
import type { ScopeDraft, ScopeExtractorHooks } from '../types.js';
export declare function draftToScope(draft: ScopeDraft): Scope;
export declare function pass1BuildScopes(matches: readonly CaptureMatch[], filePath: string, provider: ScopeExtractorHooks): ScopeDraft[];
export declare function ensureModuleScope(scopeDrafts: ScopeDraft[], matchCount: number, filePath: string): ScopeDraft;
