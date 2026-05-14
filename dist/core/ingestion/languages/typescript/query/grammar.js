import TS from 'tree-sitter-typescript';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TS_GRAMMAR = TS.typescript;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSX_GRAMMAR = TS.tsx;
function isTsxFile(filePath) {
    return filePath.endsWith('.tsx');
}
export { TS_GRAMMAR, TSX_GRAMMAR, isTsxFile };
