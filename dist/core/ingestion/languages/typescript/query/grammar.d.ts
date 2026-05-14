import Parser from 'tree-sitter';
declare const TS_GRAMMAR: Parameters<Parser["setLanguage"]>[0];
declare const TSX_GRAMMAR: Parameters<Parser["setLanguage"]>[0];
declare function isTsxFile(filePath: string): boolean;
export { TS_GRAMMAR, TSX_GRAMMAR, isTsxFile };
