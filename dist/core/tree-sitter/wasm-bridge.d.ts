import { Parser, Language } from 'web-tree-sitter';
/**
 * Initialize web-tree-sitter WASM runtime.
 * Must be called once before any grammar loading.
 *
 * Resolution order:
 *   1. Embedded `web-tree-sitter.wasm` from `WASM_GRAMMARS` base64 constant
 *   2. `node_modules/web-tree-sitter/web-tree-sitter.wasm` via `fs.readFileSync`
 *   3. Default `Parser.init()` — lets web-tree-sitter locate its own WASM
 */
export declare function initWasmRuntime(): Promise<void>;
/**
 * Load a grammar Language from embedded WASM bytes.
 *
 * @param languageKey - Key from `LANGUAGE_WASM_MAP` (e.g. `'javascript'`, `'typescript:tsx'`)
 * @returns The loaded `Language`, or `null` if the grammar is not available
 */
export declare function loadWasmGrammar(languageKey: string): Promise<Language | null>;
/**
 * Check if a WASM grammar is available (embedded) for the given language key.
 *
 * @param languageKey - Key from `LANGUAGE_WASM_MAP`
 * @returns `true` if the WASM grammar is embedded and ready to load
 */
export declare function isWasmGrammarAvailable(languageKey: string): boolean;
/**
 * List all available WASM grammar keys.
 *
 * @returns Array of language keys that have a WASM grammar mapping
 */
export declare function getAvailableWasmGrammars(): string[];
/**
 * Create a Parser for the given language.
 * Loads the grammar if needed.
 *
 * @param languageKey - Key from `LANGUAGE_WASM_MAP`
 * @returns A configured `Parser` instance with the language set
 * @throws If the grammar cannot be loaded
 */
export declare function createWasmParser(languageKey: string): Promise<Parser>;
/**
 * Get a shared Parser instance (singleton).
 * The returned parser has no language set — call `parser.setLanguage()` before parsing.
 */
export declare function getSharedParser(): Promise<Parser>;
