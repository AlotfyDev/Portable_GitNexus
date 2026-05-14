import type { ParsedFile, CaptureMatch } from '../../../_shared/index.js';
import type { ScopeExtractorHooks } from './types.js';
export declare function extract(matches: readonly CaptureMatch[], filePath: string, provider: ScopeExtractorHooks): ParsedFile;
