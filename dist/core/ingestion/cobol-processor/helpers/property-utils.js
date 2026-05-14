import { generateId } from '../../../../lib/utils.js';
/** Generate a deterministic Property node ID using composite key (section:level:name). */
function generatePropertyId(filePath, item) {
    return generateId('Property', `${filePath}:${item.section}:${item.level}:${item.name}`);
}
export { generatePropertyId };
