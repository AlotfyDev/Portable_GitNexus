import type { CobolRegexResults } from '../../cobol/cobol-preprocessor.js';
import { generatePropertyId } from './property-utils.js';

/**
 * Build a lookup Map from data item name (uppercase) to its Property node ID.
 * First-wins semantics: if the same name appears in multiple sections,
 * the first occurrence in extraction order is used for MOVE edge resolution.
 */
function buildDataItemMap(
  dataItems: CobolRegexResults['dataItems'],
  filePath: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of dataItems) {
    if (item.name === 'FILLER') continue;
    const key = item.name.toUpperCase();
    if (!map.has(key)) {
      map.set(key, generatePropertyId(filePath, item));
    }
  }
  return map;
}

export { buildDataItemMap };
