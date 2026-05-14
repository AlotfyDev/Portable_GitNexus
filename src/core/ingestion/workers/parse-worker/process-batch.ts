import { SupportedLanguages, getLanguageFromFilename } from 'gitnexus-shared';
import { isLanguageAvailable } from '../../../tree-sitter/parser-loader.js';
import { loadLanguage } from '../../../tree-sitter/parser-loader.js';
import { getProvider } from '../../languages/index.js';
import type { ParseWorkerInput, ParseWorkerResult } from './types.js';
import { processFileGroup } from './process-file-group.js';

const setLanguage = async (language: SupportedLanguages, filePath: string): Promise<void> => {
  await loadLanguage(language, filePath);
};

export const processBatch = async (
  files: ParseWorkerInput[],
  onProgress?: (filesProcessed: number) => void,
): Promise<ParseWorkerResult> => {
  const result: ParseWorkerResult = {
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

  const byLanguage = new Map<SupportedLanguages, ParseWorkerInput[]>();
  for (const file of files) {
    const lang = getLanguageFromFilename(file.path);
    if (!lang) continue;
    let list = byLanguage.get(lang);
    if (!list) {
      list = [];
      byLanguage.set(lang, list);
    }
    list.push(file);
  }

  let totalProcessed = 0;
  let lastReported = 0;
  const PROGRESS_INTERVAL = Math.max(1, Math.min(100, Math.ceil(files.length / 10)));

  const onFileProcessed = onProgress
    ? () => {
        totalProcessed++;
        if (totalProcessed - lastReported >= PROGRESS_INTERVAL) {
          lastReported = totalProcessed;
          onProgress(totalProcessed);
        }
      }
    : undefined;

  for (const [language, langFiles] of byLanguage) {
    const provider = getProvider(language);
    const queryString = provider.treeSitterQueries;
    if (!queryString) continue;

    const tsxFiles: ParseWorkerInput[] = [];
    const regularFiles: ParseWorkerInput[] = [];

    if (language === SupportedLanguages.TypeScript) {
      for (const f of langFiles) {
        if (f.path.endsWith('.tsx')) {
          tsxFiles.push(f);
        } else {
          regularFiles.push(f);
        }
      }
    } else {
      for (const f of langFiles) regularFiles.push(f);
    }

    if (regularFiles.length > 0) {
      if (isLanguageAvailable(language, regularFiles[0].path)) {
        try {
          await setLanguage(language, regularFiles[0].path);
          await processFileGroup(regularFiles, language, queryString, result, onFileProcessed);
        } catch {
        }
      } else {
        result.skippedLanguages[language] =
          (result.skippedLanguages[language] || 0) + regularFiles.length;
      }
    }

    if (tsxFiles.length > 0) {
      if (isLanguageAvailable(language, tsxFiles[0].path)) {
        try {
          await setLanguage(language, tsxFiles[0].path);
          await processFileGroup(tsxFiles, language, queryString, result, onFileProcessed);
        } catch {
        }
      } else {
        result.skippedLanguages[language] =
          (result.skippedLanguages[language] || 0) + tsxFiles.length;
      }
    }
  }

  if (onProgress && totalProcessed !== lastReported) {
    onProgress(totalProcessed);
  }

  return result;
};
