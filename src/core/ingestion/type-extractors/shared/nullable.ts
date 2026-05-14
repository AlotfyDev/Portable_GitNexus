import { NULLABLE_KEYWORDS } from './constants.js';

export const stripNullable = (typeName: string): string | undefined => {
  let text = typeName.trim();
  if (!text) return undefined;

  if (NULLABLE_KEYWORDS.has(text)) return undefined;

  if (text.endsWith('?')) text = text.slice(0, -1).trim();

  if (text.includes('|')) {
    const parts = text
      .split('|')
      .map((p) => p.trim())
      .filter((p) => p !== '' && !NULLABLE_KEYWORDS.has(p));
    if (parts.length === 1) return parts[0];
    return undefined;
  }

  return text || undefined;
};
