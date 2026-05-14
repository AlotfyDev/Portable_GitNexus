import Parser from 'tree-sitter';
import { TS_GRAMMAR, TSX_GRAMMAR, isTsxFile } from './grammar.js';
import { TYPESCRIPT_SCOPE_QUERY } from './queries.js';
const TSX_JSX_QUERY_SUFFIX = `
;; <Foo />
((jsx_self_closing_element
  name: (identifier) @reference.name) @reference.call.free
  (#match? @reference.name "^[A-Z]"))

;; <Foo> ... </Foo>  (paired form — match the opening tag only)
((jsx_opening_element
  name: (identifier) @reference.name) @reference.call.free
  (#match? @reference.name "^[A-Z]"))

;; <Foo.Bar />  /  <Container.Section.Title />  — namespaced JSX
(jsx_self_closing_element
  name: (member_expression
    object: (_) @reference.receiver
    property: (property_identifier) @reference.name)) @reference.call.member

(jsx_opening_element
  name: (member_expression
    object: (_) @reference.receiver
    property: (property_identifier) @reference.name)) @reference.call.member
`;
let _tsParser = null;
let _tsxParser = null;
let _tsQuery = null;
let _tsxQuery = null;
export function getTsParser(filePath) {
    if (filePath !== undefined && isTsxFile(filePath)) {
        if (_tsxParser === null) {
            _tsxParser = new Parser();
            _tsxParser.setLanguage(TSX_GRAMMAR);
        }
        return _tsxParser;
    }
    if (_tsParser === null) {
        _tsParser = new Parser();
        _tsParser.setLanguage(TS_GRAMMAR);
    }
    return _tsParser;
}
export function getTsScopeQuery(filePath) {
    if (filePath !== undefined && isTsxFile(filePath)) {
        if (_tsxQuery === null) {
            _tsxQuery = new Parser.Query(TSX_GRAMMAR, TYPESCRIPT_SCOPE_QUERY + TSX_JSX_QUERY_SUFFIX);
        }
        return _tsxQuery;
    }
    if (_tsQuery === null) {
        _tsQuery = new Parser.Query(TS_GRAMMAR, TYPESCRIPT_SCOPE_QUERY);
    }
    return _tsQuery;
}
export function tsCachedTreeMatchesGrammar(tree, filePath) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lang = tree?.getLanguage?.();
    if (lang === undefined || lang === null)
        return true;
    return isTsxFile(filePath) ? lang === TSX_GRAMMAR : lang === TS_GRAMMAR;
}
