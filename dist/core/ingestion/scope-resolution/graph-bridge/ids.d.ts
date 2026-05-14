/**
 * Scope-resolution → legacy graph-node ID bridging.
 *
 * Two functions:
 *   - `resolveDefGraphId` — turn a scope-resolution `SymbolDefinition`
 *     into the graph's node id for the corresponding legacy node.
 *   - `resolveCallerGraphId` — walk a scope chain from a reference
 *     site upward to find the enclosing function/method/class and
 *     return its graph-node id. Falls back to the File node for
 *     module-level calls so those still get an edge source.
 *
 * Next-consumer contract: language-agnostic. Any OO language with
 * file-level module semantics (TypeScript, Java, Go, Kotlin) can
 * reuse `resolveCallerGraphId` as-is. Languages with different
 * top-level semantics (COBOL programs, Rust crate modules) may want
 * a different file-level fallback — cross that bridge when they
 * migrate.
 */
import type { NodeLabel, ScopeId, SymbolDefinition } from '../../../../_shared/index.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import { type GraphNodeLookup } from '../graph-bridge/node-lookup.js';
/**
 * Look up a `SymbolDefinition` in the graph node lookup.
 *
 * Tries the type-prefixed fully-qualified key FIRST. That's the only
 * correct key when:
 *   - Two classes in the same file define a method with the same
 *     simple name (`class User: def save` + `class Document: def save`).
 *   - A top-level function and a class method share a simple name
 *     (`def save` + `class User: def save` — the Function's qualifier
 *     is just `save`, which would alias the Method's simple-key slot
 *     without the type prefix).
 *
 * Falls back to the simple name for definitions whose qualifier the
 * lookup didn't capture (rare, but keeps cross-file simple-name
 * resolution working for languages that don't yet synthesize
 * qualifiers).
 */
export declare function resolveDefGraphId(filePath: string, def: {
    qualifiedName?: string;
    type?: NodeLabel;
    parameterTypes?: readonly string[];
}, nodeLookup: GraphNodeLookup): string | undefined;
/** Derive the simple (unqualified) name of a def from its `qualifiedName`. */
export declare function simpleQualifiedName(def: SymbolDefinition): string | undefined;
/**
 * Walk the scope chain from `startScope` upward looking for the first
 * scope whose `ownedDefs` contains a Function/Method/Class — that's
 * our caller anchor. Translate via `nodeLookup` to the graph-node ID.
 *
 * Module-level references (e.g. Python `u = models.User()` at top
 * level) have no enclosing function/method/class. Fall back to the
 * File node for the scope's filePath so those calls still get an
 * edge source. Matches legacy DAG behavior where module-level CALLS
 * edges originate from the file symbol.
 */
export declare function resolveCallerGraphId(startScope: ScopeId, scopes: ScopeResolutionIndexes, nodeLookup: GraphNodeLookup): string | undefined;
