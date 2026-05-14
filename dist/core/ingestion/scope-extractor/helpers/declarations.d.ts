import type { PositionIndex, ScopeTree } from '../../../../_shared/index.js';
import type { SymbolDefinition, CaptureMatch } from '../../../../_shared/index.js';
import type { ScopeDraft, ScopeExtractorHooks } from '../types.js';
export declare function pass2AttachDeclarations(matches: readonly CaptureMatch[], drafts: readonly ScopeDraft[], positionIndex: PositionIndex, localDefs: SymbolDefinition[], filePath: string, provider: ScopeExtractorHooks, scopeTree: ScopeTree): void;
