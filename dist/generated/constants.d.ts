/** GitNexus version — read from package.json at generation time */
export declare const GITNEXUS_VERSION = "1.6.4";
/** True when built as standalone portable binary via bun build --compile */
export declare const IS_PORTABLE_BUILD = false;
/**
 * App root URL for development mode (null in portable builds).
 * In dev mode: URL pointing to gitnexus/ package root.
 * In portable: null (files are baked into the binary).
 */
export declare const DEV_APP_ROOT_URL: string | null;
/**
 * Whether onnxruntime-node (embeddings) should be enabled.
 * Disabled in portable builds because it's a native .node addon.
 */
export declare const EMBEDDINGS_ENABLED = true;
