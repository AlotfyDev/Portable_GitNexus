/**
 * LLM Client for Wiki Generation
 *
 * OpenAI-compatible API client using native fetch.
 * Supports OpenAI, Azure, LiteLLM, Ollama, and any OpenAI-compatible endpoint.
 *
 * Config priority: CLI flags > env vars > defaults
 */
export type LLMProvider = 'openai' | 'openrouter' | 'azure' | 'custom' | 'cursor';
export interface LLMConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    /** Provider type — controls auth header behaviour */
    provider?: 'openai' | 'openrouter' | 'azure' | 'custom' | 'cursor';
    /** Azure api-version query param (e.g. '2024-10-21'). Appended to URL when set. */
    apiVersion?: string;
    /** When true, strips sampling params and uses max_completion_tokens instead of max_tokens */
    isReasoningModel?: boolean;
}
export interface LLMResponse {
    content: string;
    promptTokens?: number;
    completionTokens?: number;
}
/**
 * Resolve LLM configuration from env vars, saved config, and optional overrides.
 * Priority: overrides (CLI flags) > env vars > ~/.gitnexus/config.json > error
 *
 * If no API key is found, returns config with empty apiKey (caller should handle).
 */
export declare function resolveLLMConfig(overrides?: Partial<LLMConfig>): Promise<LLMConfig>;
/**
 * Estimate token count from text (rough heuristic: ~4 chars per token).
 */
export declare function estimateTokens(text: string): number;
/**
 * Validate that a base URL supplied for LLM API calls is a safe HTTP/HTTPS
 * endpoint (CWE-918 / CodeQL js/http-to-file-access).
 *
 * Allowed:
 *  - https:// with any hostname (public LLM APIs, Azure, OpenRouter, …)
 *  - http:// restricted to localhost / 127.0.0.1 (local servers: Ollama, LiteLLM, …)
 *
 * Rejected:
 *  - file://, data:, javascript:, and any other non-HTTP scheme
 *  - http:// aimed at non-loopback hosts (avoids SSRF against internal networks)
 *
 * Throws with a descriptive message on validation failure so callers surface a
 * clear error rather than an opaque network error.
 */
export declare function validateLLMBaseUrl(baseUrl: string): void;
/**
 * Returns true if the given base URL is an Azure OpenAI endpoint.
 * Uses proper hostname matching to avoid spoofed URLs like
 * "https://myresource.openai.azure.com.evil.com/v1".
 */
export declare function isAzureProvider(baseUrl: string): boolean;
/**
 * Returns true if the model name matches a known reasoning model pattern,
 * or if the explicit override is true.
 * Pass override=false to force non-reasoning even for o-series names.
 */
export declare function isReasoningModel(model: string, override?: boolean): boolean;
/**
 * Build the full chat completions URL, appending ?api-version when provided.
 */
export declare function buildRequestUrl(baseUrl: string, apiVersion: string | undefined): string;
export interface CallLLMOptions {
    onChunk?: (charsReceived: number) => void;
}
/**
 * Call an OpenAI-compatible LLM API.
 * Uses streaming when onChunk callback is provided for real-time progress.
 * Retries up to 3 times on transient failures (429, 5xx, network errors).
 */
export declare function callLLM(prompt: string, config: LLMConfig, systemPrompt?: string, options?: CallLLMOptions): Promise<LLMResponse>;
