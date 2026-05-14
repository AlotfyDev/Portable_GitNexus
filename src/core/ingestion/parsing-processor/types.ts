import type { ExtractedHeritage } from '../model/index.js';
import type {
  ExtractedImport,
  ExtractedCall,
  ExtractedAssignment,
  ExtractedRoute,
  ExtractedFetchCall,
  ExtractedDecoratorRoute,
  ExtractedToolDef,
  ExtractedORMQuery,
  FileConstructorBindings,
  FileScopeBindings,
} from '../workers/parse-worker.js';
import type { ParsedFile } from 'gitnexus-shared';

export type FileProgressCallback = (current: number, total: number, filePath: string) => void;

export interface WorkerExtractedData {
  imports: ExtractedImport[];
  calls: ExtractedCall[];
  assignments: ExtractedAssignment[];
  heritage: ExtractedHeritage[];
  routes: ExtractedRoute[];
  fetchCalls: ExtractedFetchCall[];
  decoratorRoutes: ExtractedDecoratorRoute[];
  toolDefs: ExtractedToolDef[];
  ormQueries: ExtractedORMQuery[];
  constructorBindings: FileConstructorBindings[];
  fileScopeBindings: FileScopeBindings[];
  parsedFiles: ParsedFile[];
}
