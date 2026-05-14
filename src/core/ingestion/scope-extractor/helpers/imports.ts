import type { CaptureMatch, ParsedImport } from 'gitnexus-shared';
import type { ScopeExtractorHooks } from '../types.js';
import { anchorCaptureFor } from './capture-utils.js';

export function pass3CollectImports(
  matches: readonly CaptureMatch[],
  parsedImports: ParsedImport[],
  provider: ScopeExtractorHooks,
): void {
  if (provider.interpretImport === undefined) return;
  for (const match of matches) {
    const anchor = anchorCaptureFor(match, '@import.');
    if (anchor === undefined) continue;
    const parsed = provider.interpretImport(match);
    if (parsed === null) continue;
    parsedImports.push(parsed);
  }
}
