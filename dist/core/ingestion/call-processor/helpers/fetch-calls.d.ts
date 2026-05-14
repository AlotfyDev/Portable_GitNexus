import type { ASTCache } from '../../ast-cache.js';
import type { ExtractedFetchCall } from '../../workers/parse-worker.js';
export declare const extractFetchCallsFromFiles: (files: {
    path: string;
    content: string;
}[], astCache: ASTCache) => Promise<ExtractedFetchCall[]>;
