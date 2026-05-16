import { generateId } from '../../utils/generate-id.js';

/** Generate a deterministic Property node ID using composite key (section:level:name). */
function generatePropertyId(
  filePath: string,
  item: { section: string; level: number; name: string },
): string {
  return generateId('Property', `${filePath}:${item.section}:${item.level}:${item.name}`);
}

export { generatePropertyId };
