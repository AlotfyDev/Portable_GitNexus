import { SupportedLanguages } from '../../../../_shared/index.js';
import type { ParseWorkerInput, ParseWorkerResult } from './types.js';
export declare const processFileGroup: (files: ParseWorkerInput[], language: SupportedLanguages, queryString: string, result: ParseWorkerResult, onFileProcessed?: () => void) => Promise<void>;
