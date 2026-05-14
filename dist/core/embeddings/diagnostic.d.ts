/**
 * Diagnostic utilities for the embedding pipeline.
 * Logs per-label node counts to help diagnose 0-embedding scenarios.
 */
/**
 * Log the count of nodes for each embeddable label.
 * This helps diagnose why embeddings might be 0 despite nodes existing.
 * Non-fatal — failures are silently swallowed.
 */
export declare function logPerLabelNodeCounts(executeQuery: (cypher: string) => Promise<any>, log: (msg: string) => void): Promise<void>;
