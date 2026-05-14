import { generatePropertyId } from './property-utils.js';
/**
 * Build a lookup Map from data item name (uppercase) to its Property node ID.
 * First-wins semantics: if the same name appears in multiple sections,
 * the first occurrence in extraction order is used for MOVE edge resolution.
 */
function buildDataItemMap(dataItems, filePath) {
    const map = new Map();
    for (const item of dataItems) {
        if (item.name === 'FILLER')
            continue;
        const key = item.name.toUpperCase();
        if (!map.has(key)) {
            map.set(key, generatePropertyId(filePath, item));
        }
    }
    return map;
}
export { buildDataItemMap };
