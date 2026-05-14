/**
 * Vue SFC (Single File Component) script extractor.
 *
 * Extracts the <script> / <script setup> block content from .vue files
 * so it can be parsed by the TypeScript tree-sitter grammar.
 *
 * Pure function — no tree-sitter dependency, safe for worker threads.
 */
export interface VueScriptExtraction {
    /** Extracted script content (TypeScript/JavaScript) */
    scriptContent: string;
    /** 0-based line number in the .vue file where the script content starts */
    lineOffset: number;
    /** true if the primary block is <script setup> */
    isSetup: boolean;
}
/**
 * Extract script content from a Vue SFC.
 *
 * When both <script> and <script setup> are present, returns only the
 * <script setup> block (the dominant pattern — 94% of Vue files in real
 * projects use setup). The <script> (non-setup) block typically contains
 * only `defineOptions` or legacy option merges and is less important for
 * the knowledge graph.
 */
export declare function extractVueScript(vueContent: string): VueScriptExtraction | null;
/**
 * Vue <script setup>: all top-level bindings are implicitly exported.
 * Returns true if the node (or any ancestor) has the `program` root as its
 * direct parent — i.e. the node is at the top level of the script block.
 *
 * Shared between the worker and sequential parsing paths.
 */
export declare const isVueSetupTopLevel: (node: {
    parent: {
        type: string;
        parent: unknown;
    } | null;
} | null) => boolean;
/**
 * Extract PascalCase component names used in <template>.
 * Returns deduplicated component names (e.g., ["MyButton", "AppHeader"]).
 */
export declare function extractTemplateComponents(vueContent: string): string[];
