/**
 * Build a `(filePath, name) → graphNodeId` lookup over the graph's
 * Function/Method/Class/Constructor nodes. Two keys per node:
 *
 *   - simple name (`User` / `save`) — legacy fallback
 *   - qualified name when derivable from the node id (`User.save`)
 *
 * The qualified key is the authoritative one when two classes in the
 * same file define a method with the same simple name
 * (`class User: def save` + `class Document: def save`). Without it,
 * the simple-name key collides and every `document.save()` CALLS edge
 * would silently target `User.save`. Method node ids encode the
 * qualifier (`Method:file.py:User.save#1`), so we parse it back out.
 *
 * Language-agnostic seam. Any language provider migrating to the
 * registry-primary path can consume this to translate scope-resolution
 * `SymbolDefinition.nodeId` values into the legacy graph-node ID
 * format that downstream consumers (queries, edges, MCP) expect.
 */
import type { NodeLabel } from '../../../../_shared/index.js';
import type { KnowledgeGraph } from '../../../graph/types.js';
export type GraphNodeLookup = ReadonlyMap<string, string>;
/**
 * Build a qualified-key string in a separate keyspace from simple-key
 * strings. Prefix `<q>` can't appear in a valid filePath on any OS, so
 * no collision between the two keyspaces is possible.
 *
 * Includes the node label so a top-level `def save` (Function,
 * qualifier = `save`) doesn't alias a class method `User.save` (Method,
 * simple name = `save`) whose Function-typed qualifier would collapse
 * to the same simple-key slot in a single map.
 */
export declare function qualifiedKey(filePath: string, label: NodeLabel, qualifiedName: string): string;
/** Simple-name key (legacy fallback keyspace — no `<q>` prefix). */
export declare function simpleKey(filePath: string, name: string): string;
export declare function buildGraphNodeLookup(graph: KnowledgeGraph): GraphNodeLookup;
export declare function isLinkableLabel(label: NodeLabel): boolean;
