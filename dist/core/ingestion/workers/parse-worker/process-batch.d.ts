import type { ParseWorkerInput, ParseWorkerResult } from './types.js';
export declare const processBatch: (files: ParseWorkerInput[], onProgress?: (filesProcessed: number) => void) => Promise<ParseWorkerResult>;
