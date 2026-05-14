import type { HttpLanguagePlugin } from './types.js';
export type { HttpDetection, HttpLanguagePlugin, HttpRole } from './types.js';
/**
 * Glob for files worth scanning for HTTP routes. Kept alongside the
 * registry so adding a new language widens the glob in one edit.
 *
 * `.vue` / `.svelte` files are intentionally omitted for the source-scan
 * path — they need their own grammar-aware extraction and the existing
 * regex fallback for them was never very accurate. The graph-assisted
 * Strategy A still handles them via the ingestion pipeline.
 */
export declare const HTTP_SCAN_GLOB = "**/*.{ts,tsx,js,jsx,java,go,py,php}";
/**
 * Return the HTTP plugin registered for the given file's extension,
 * or `undefined` if the extension is not registered.
 */
export declare function getPluginForFile(rel: string): HttpLanguagePlugin | undefined;
