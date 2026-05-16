import { KnowledgeGraph } from '../../graph/types.js';
import type { SymbolTableWriter } from '../model/index.js';
import { ASTCache } from '../ast-cache.js';
import type { FileProgressCallback, WorkerExtractedData } from './types.js';
import type { WorkerPool } from '../workers/worker-pool.js';
import { LoggerProviderRegistry } from '../../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();
import { processParsingWithWorkers } from './helpers/worker-dispatch.js';
import { processParsingSequential } from './helpers/sequential.js';

export const processParsing = async (
  graph: KnowledgeGraph,
  files: { path: string; content: string }[],
  symbolTable: SymbolTableWriter,
  astCache: ASTCache,
  scopeTreeCache: ASTCache | undefined,
  onFileProgress?: FileProgressCallback,
  workerPool?: WorkerPool,
): Promise<WorkerExtractedData | null> => {
  let lastProgress = 0;
  const reportProgress: FileProgressCallback | undefined = onFileProgress
    ? (current, total, detail) => {
        lastProgress = Math.max(lastProgress, current);
        onFileProgress(lastProgress, total, detail);
      }
    : undefined;

  if (workerPool) {
    if (scopeTreeCache !== undefined && process.env.PROF_SCOPE_RESOLUTION === '1') {
      logger.warn(
        `[scope-resolution prof] worker pool engaged for ${files.length} files — cross-phase tree cache will be empty; scope-resolution re-parses.`,
      );
    }
    try {
      return await processParsingWithWorkers(
        graph,
        files,
        symbolTable,
        astCache,
        workerPool,
        reportProgress,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ message }, 'Worker pool parsing stopped; continuing with sequential parser:');
      reportProgress?.(
        lastProgress,
        files.length,
        `Sequential fallback after worker issue: ${message}`,
      );
    }
  }

  await processParsingSequential(
    graph,
    files,
    symbolTable,
    astCache,
    scopeTreeCache,
    reportProgress,
  );
  return null;
};
