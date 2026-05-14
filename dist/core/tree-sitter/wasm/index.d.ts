/** Grammar WASM files keyed by snake_case identifier. */
export declare const grammarWasm: Record<string, string>;
/** Runtime WASM binary for web-tree-sitter. */
export declare const runtimeWasm: string;
export interface WasmGrammarEntry {
    varName: string;
    exportName: string;
    pkg: string;
    sizeKB: string;
}
export declare const WASM_GRAMMAR_REGISTRY: WasmGrammarEntry[];
