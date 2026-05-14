/**
 * File→File IMPORTS edge emission from a finalized `ImportEdge` map.
 *
 * Deduplicates by `(sourceFile, targetFile)` so multi-symbol imports
 * from the same module collapse to a single edge — matching the
 * legacy schema.
 *
 * Next-consumer contract: language-agnostic. Any provider with a
 * scope-resolution ImportEdge stream emits File→File edges via this
 * single function. The `reason` defaults to
 * `'scope-resolution: import'`; provider may override if downstream
 * filters on reason.
 */
import type { ImportEdge, ScopeId } from '../../../../_shared/index.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
export declare function emitImportEdges(graph: KnowledgeGraph, imports: ReadonlyMap<ScopeId, readonly ImportEdge[]>, scopeTree: ScopeResolutionIndexes['scopeTree'], reason?: string): number;
