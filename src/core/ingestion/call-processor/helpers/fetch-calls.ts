import Parser from 'tree-sitter';
import type { ASTCache } from '../../ast-cache.js';
import type { ExtractedFetchCall } from '../../workers/parse-worker.js';
import { isLanguageAvailable, loadParser, loadLanguage } from '../../../tree-sitter/parser-loader.js';
import { getProvider } from '../../languages/index.js';
import { getLanguageFromFilename } from 'gitnexus-shared';

export const extractFetchCallsFromFiles = async (
  files: { path: string; content: string }[],
  astCache: ASTCache,
): Promise<ExtractedFetchCall[]> => {
  const parser = await loadParser();
  const result: ExtractedFetchCall[] = [];

  for (const file of files) {
    const language = getLanguageFromFilename(file.path);
    if (!language) continue;
    if (!isLanguageAvailable(language)) continue;

    const provider = getProvider(language);
    const queryStr = provider.treeSitterQueries;
    if (!queryStr) continue;

    await loadLanguage(language, file.path);

    let tree = astCache.get(file.path) as unknown as Parser.Tree | undefined;
    if (!tree) {
      const parseContent = provider.preprocessSource?.(file.content, file.path) ?? file.content;
      try {
        tree = parser.parse(parseContent, undefined) as unknown as Parser.Tree;
      } catch {
        continue;
      }
      astCache.set(file.path, tree);
    }

    let matches;
    try {
      const lang = parser.language;
      const query = new Parser.Query(lang, queryStr);
      matches = query.matches(tree.rootNode);
    } catch {
      continue;
    }

    for (const match of matches) {
      const captureMap: Record<string, any> = {};
      match.captures.forEach((c) => (captureMap[c.name] = c.node));

      if (captureMap['route.fetch']) {
        const urlNode = captureMap['route.url'] ?? captureMap['route.template_url'];
        if (urlNode) {
          result.push({
            filePath: file.path,
            fetchURL: urlNode.text,
            lineNumber: captureMap['route.fetch'].startPosition.row,
          });
        }
      } else if (captureMap['http_client'] && captureMap['http_client.url']) {
        const method = captureMap['http_client.method']?.text;
        const url = captureMap['http_client.url'].text;
        const HTTP_CLIENT_ONLY = new Set(['head', 'options', 'request', 'ajax']);
        if (method && HTTP_CLIENT_ONLY.has(method) && url.startsWith('/')) {
          result.push({
            filePath: file.path,
            fetchURL: url,
            lineNumber: captureMap['http_client'].startPosition.row,
          });
        }
      }
    }
  }

  return result;
};
