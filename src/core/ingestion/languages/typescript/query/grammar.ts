import Parser from 'tree-sitter';
import TS from 'tree-sitter-typescript';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TS_GRAMMAR = (TS as any).typescript as Parameters<Parser['setLanguage']>[0];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSX_GRAMMAR = (TS as any).tsx as Parameters<Parser['setLanguage']>[0];

function isTsxFile(filePath: string): boolean {
  return filePath.endsWith('.tsx');
}

export { TS_GRAMMAR, TSX_GRAMMAR, isTsxFile };
