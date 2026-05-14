import { parentPort } from 'node:worker_threads';

import type { ParseWorkerResult, ParseWorkerInput, WorkerIncomingMessage } from './parse-worker/types.js';

import { processBatch } from './parse-worker/process-batch.js';
import { appendAll, mergeResult } from './parse-worker/helpers/merge.js';

export type {
  ExtractedCall,
  ExtractedAssignment,
  ExtractedRoute,
  ExtractedFetchCall,
  ExtractedDecoratorRoute,
  ExtractedToolDef,
  ExtractedORMQuery,
  ExtractedImport,
  FileConstructorBindings,
  FileScopeBindings,
  ParseWorkerResult,
  ParseWorkerInput,
} from './parse-worker/types.js';

let accumulated: ParseWorkerResult = {
  nodes: [],
  relationships: [],
  symbols: [],
  imports: [],
  calls: [],
  assignments: [],
  heritage: [],
  routes: [],
  fetchCalls: [],
  decoratorRoutes: [],
  toolDefs: [],
  ormQueries: [],
  constructorBindings: [],
  fileScopeBindings: [],
  parsedFiles: [],
  skippedLanguages: {},
  fileCount: 0,
};
let cumulativeProcessed = 0;

parentPort!.on('message', async (msg: WorkerIncomingMessage) => {
  try {
    if (Array.isArray(msg)) {
      const result = await processBatch(msg, (filesProcessed) => {
        parentPort!.postMessage({ type: 'progress', filesProcessed });
      });
      parentPort!.postMessage({ type: 'result', data: result });
      return;
    }

    if (msg.type === 'sub-batch') {
      const result = await processBatch(msg.files, (filesProcessed) => {
        parentPort!.postMessage({
          type: 'progress',
          filesProcessed: cumulativeProcessed + filesProcessed,
        });
      });
      cumulativeProcessed += result.fileCount;
      mergeResult(accumulated, result);
      parentPort!.postMessage({ type: 'sub-batch-done' });
      return;
    }

    if (msg.type === 'flush') {
      parentPort!.postMessage({ type: 'result', data: accumulated });
      accumulated = {
        nodes: [],
        relationships: [],
        symbols: [],
        imports: [],
        calls: [],
        assignments: [],
        heritage: [],
        routes: [],
        fetchCalls: [],
        decoratorRoutes: [],
        toolDefs: [],
        ormQueries: [],
        constructorBindings: [],
        fileScopeBindings: [],
        parsedFiles: [],
        skippedLanguages: {},
        fileCount: 0,
      };
      cumulativeProcessed = 0;
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    parentPort!.postMessage({ type: 'error', error: message });
  }
});
