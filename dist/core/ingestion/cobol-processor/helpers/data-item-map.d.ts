import type { CobolRegexResults } from '../../cobol/cobol-preprocessor.js';
/**
 * Build a lookup Map from data item name (uppercase) to its Property node ID.
 * First-wins semantics: if the same name appears in multiple sections,
 * the first occurrence in extraction order is used for MOVE edge resolution.
 */
declare function buildDataItemMap(dataItems: CobolRegexResults['dataItems'], filePath: string): Map<string, string>;
export { buildDataItemMap };
