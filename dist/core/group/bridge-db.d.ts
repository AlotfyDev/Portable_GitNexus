import type { LbugValue } from '@ladybugdb/core';
import type { BridgeHandle, BridgeMeta, StoredContract, CrossLink, RepoSnapshot } from './types.js';
export declare function contractNodeId(repo: string, contractId: string, role: string, filePath: string): string;
/**
 * In-memory index of contract node IDs keyed three ways, mirroring the
 * three-tier fallback lookup in {@link findContractNode}. Built once per
 * `writeBridge` call after all contracts are successfully inserted, then
 * consulted for every cross-link — which eliminates the former N+1 query
 * pattern (up to `6 × cross-links` DB round-trips) and turns cross-link
 * resolution into constant-time per link.
 *
 * Keys are deliberately flat strings (not tuples) so `Map<string, ...>`
 * works; the separator `\0` can't occur in any legal repo path / file
 * path / symbol identifier, which makes the encoding injection-safe.
 */
export interface ContractLookupIndex {
    /** tier 1: `repo + role + symbolUid` → contract node id */
    byUid: Map<string, string>;
    /** tier 2: `repo + role + filePath + symbolName` → contract node id */
    byRef: Map<string, string>;
    /** tier 3: `repo + role + filePath` → list of contract node ids in that file */
    byFile: Map<string, string[]>;
}
export declare function createContractLookupIndex(): ContractLookupIndex;
/**
 * Add a successfully-inserted contract to the lookup index. Must be called
 * AFTER the DB insert succeeds (not before) so failed inserts don't poison
 * the index and cause cross-links to point at non-existent rows.
 */
export declare function indexContract(index: ContractLookupIndex, contract: StoredContract, nodeId: string): void;
/**
 * Resolve a cross-link endpoint (consumer or provider reference) to an
 * already-inserted contract node id. Returns `null` if no match — the
 * caller is expected to count that as a dropped link in `WriteBridgeReport`.
 *
 * The resolution order matches the pre-cache DB-query behavior:
 *   1. exact `symbolUid` match in the same `(repo, role)` scope
 *   2. exact `(filePath, symbolName)` match
 *   3. if exactly one contract lives in the file → that one (fallback for
 *      legacy graph-assisted extractors that couldn't resolve a symbol name)
 *
 * This is a pure function — no I/O, no DB — so it's trivial to unit-test
 * in isolation (which was the reviewer's main clean-code concern on the
 * original 35-line inner closure in `writeBridge`).
 */
export declare function findContractNode(index: ContractLookupIndex, repo: string, role: 'consumer' | 'provider', symbolUid: string, filePath: string, symbolName: string): string | null;
export declare function openBridgeDb(dbPath: string): Promise<BridgeHandle>;
export declare function ensureBridgeSchema(handle: BridgeHandle): Promise<void>;
export declare function queryBridge<T>(handle: BridgeHandle, cypher: string, params?: Record<string, LbugValue>): Promise<T[]>;
export declare function closeBridgeDb(handle: BridgeHandle): Promise<void>;
export declare function retryRename(src: string, dst: string, attempts?: number): Promise<void>;
export declare function writeBridgeMeta(groupDir: string, meta: BridgeMeta): Promise<void>;
export declare function readBridgeMeta(groupDir: string): Promise<BridgeMeta>;
export interface WriteBridgeInput {
    contracts: StoredContract[];
    crossLinks: CrossLink[];
    repoSnapshots: Record<string, RepoSnapshot>;
    missingRepos: string[];
}
/**
 * Non-fatal issues encountered during writeBridge. Callers can log these to
 * surface partial-success state without aborting the whole sync.
 * `sampleErrors` is capped at MAX_SAMPLE_ERRORS per category to bound memory.
 */
export interface WriteBridgeReport {
    contractsInserted: number;
    contractsFailed: number;
    snapshotsInserted: number;
    snapshotsFailed: number;
    linksInserted: number;
    linksFailed: number;
    /** Cross-links skipped because their from/to contract nodes weren't found. */
    linksDroppedMissingNode: number;
    sampleErrors: Array<{
        kind: 'contract' | 'snapshot' | 'link';
        id: string;
        message: string;
    }>;
}
export declare function writeBridge(groupDir: string, input: WriteBridgeInput): Promise<WriteBridgeReport>;
export declare function openBridgeDbReadOnly(groupDir: string): Promise<BridgeHandle | null>;
export declare function bridgeExists(groupDir: string): Promise<boolean>;
