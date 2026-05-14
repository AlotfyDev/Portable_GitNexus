/**
 * Graph edge emission primitives.
 *
 * Two functions:
 *   - `mapReferenceKindToEdgeType` — translate a scope-resolution
 *     `Reference.kind` into the corresponding graph edge type.
 *   - `tryEmitEdge` — given a reference site + target def, resolve
 *     caller + target to graph ids and emit the edge with
 *     language-provided reason text, dedup-keyed by
 *     `(edgeType, callerId, targetId, line, col)`.
 *
 * Next-consumer contract: any language provider can call `tryEmitEdge`
 * from its own post-pass to emit edges it resolves Python-specific
 * (or TypeScript-specific, etc.) logic. The dedup key is
 * language-agnostic — no language needs to change it.
 */
import type { Reference, ScopeId, SymbolDefinition } from '../../../../_shared/index.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { GraphNodeLookup } from '../graph-bridge/node-lookup.js';
/**
 * Map a `Reference.kind` to a graph edge type. `import-use` is dropped
 * (no edge type today — provenance lives on the IMPORTS edge emitted
 * by `emitImportEdges`).
 */
export declare function mapReferenceKindToEdgeType(kind: Reference['kind']): 'CALLS' | 'ACCESSES' | 'EXTENDS' | 'USES' | undefined;
/**
 * Resolve caller + target to graph ids and emit the edge. Returns true
 * if the edge was emitted (not deduped, not skipped).
 *
 * `seen` is a language-shared dedup set keyed by
 * `${edgeType}:${callerGraphId}->${targetGraphId}:${line}:${col}` so
 * multiple language-specific post-passes can share it and never
 * double-emit a resolution one of them already produced.
 */
export declare function tryEmitEdge(graph: KnowledgeGraph, scopes: ScopeResolutionIndexes, nodeLookup: GraphNodeLookup, site: {
    readonly inScope: ScopeId;
    readonly atRange: {
        startLine: number;
        startCol: number;
    };
    readonly kind: string;
}, targetDef: SymbolDefinition, reason: string, seen: Set<string>, confidence?: number, collapseByCallerTarget?: boolean): boolean;
