/**
 * Diagnostic utilities for the embedding pipeline.
 * Logs per-label node counts to help diagnose 0-embedding scenarios.
 */

const EMBEDDABLE_LABELS_NAMES = [
  'Function', 'Method', 'Constructor', 'Class', 'Interface',
  'Struct', 'Enum', 'Trait', 'Impl', 'Macro', 'Namespace',
  'TypeAlias', 'Typedef', 'Const', 'Property', 'Record',
  'Union', 'Static', 'Variable',
];

/**
 * Log the count of nodes for each embeddable label.
 * This helps diagnose why embeddings might be 0 despite nodes existing.
 * Non-fatal — failures are silently swallowed.
 */
export async function logPerLabelNodeCounts(
  executeQuery: (cypher: string) => Promise<any>,
  log: (msg: string) => void,
): Promise<void> {
  try {
    for (const label of EMBEDDABLE_LABELS_NAMES) {
      try {
        const result = await executeQuery(
          `MATCH (n:\`${label}\`) RETURN count(n) AS cnt`,
        );
        const count = Number(result[0]?.cnt ?? result[0]?.[0] ?? 0);
        if (count > 0) {
          log(`  ${label}: ${count} nodes`);
        }
      } catch {
        /* table may not exist */
      }
    }
  } catch {
    /* diagnostic non-fatal */
  }
}
