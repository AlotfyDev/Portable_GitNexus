/**
 * Translate the resolved `ReferenceIndex` into legacy graph edges.
 *
 * Per reference:
 *   1. Resolve `fromScope` → caller graph-node id by walking the scope
 *      chain looking for an enclosing Function/Method/Class.
 *   2. Resolve `toDef` → target graph-node id via `nodeLookup`.
 *   3. Emit the edge (`CALLS` / `READS` / `WRITES` / `EXTENDS` / `USES`)
 *      with the standard reason format.
 *
 * Skips (without throwing) when either side fails to map — either side
 * may legitimately not exist as a graph node (e.g. a resolved target
 * lives in an external file that wasn't ingested into the graph).
 *
 * Next-consumer contract: this function is the canonical bridge from
 * a shared `ReferenceIndex` into per-language graph edges. Every
 * registry-primary language provider calls this exactly once with its
 * `referenceIndex` output and its own `nodeLookup`.
 */
import type { Reference, ScopeId } from '../../../../_shared/index.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { GraphNodeLookup } from '../graph-bridge/node-lookup.js';
/**
 * Optional opaque skip key — providers may pre-emit edges (e.g. via
 * receiver-bound post-passes) and want this loop to skip references at
 * the same source position so the shared resolver's potentially-wrong
 * fallback resolution doesn't fight the precise emission. The key is
 * `${filePath}:${startLine}:${startCol}`.
 */
type ReferenceSiteSkipSet = ReadonlySet<string>;
export declare function emitReferencesViaLookup(graph: KnowledgeGraph, scopes: ScopeResolutionIndexes, referenceIndex: {
    readonly bySourceScope: ReadonlyMap<ScopeId, readonly Reference[]>;
}, nodeLookup: GraphNodeLookup, skipSites?: ReferenceSiteSkipSet): {
    emitted: number;
    skipped: number;
};
export {};
