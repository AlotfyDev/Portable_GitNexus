import Parser from 'tree-sitter';
export declare function getTsParser(filePath?: string): Parser;
export declare function getTsScopeQuery(filePath?: string): Parser.Query;
export declare function tsCachedTreeMatchesGrammar(tree: unknown, filePath: string): boolean;
