/**
 * LLM Provider Types
 *
 * Type definitions for multi-provider LLM support.
 * Supports OpenAI, Azure OpenAI, Gemini, Anthropic, Ollama, OpenRouter, MiniMax, and GLM5.
 */

export type LLMProvider =
  | 'openai'
  | 'azure-openai'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'openrouter'
  | 'minimax'
  | 'glm';

export interface BaseProviderConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenAIConfig extends BaseProviderConfig {
  provider: 'openai';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AzureOpenAIConfig extends BaseProviderConfig {
  provider: 'azure-openai';
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
}

export interface GeminiConfig extends BaseProviderConfig {
  provider: 'gemini';
  apiKey: string;
  model: string;
}

export interface AnthropicConfig extends BaseProviderConfig {
  provider: 'anthropic';
  apiKey: string;
  model: string;
}

export interface OllamaConfig extends BaseProviderConfig {
  provider: 'ollama';
  baseUrl?: string;
  model: string;
}

export interface OpenRouterConfig extends BaseProviderConfig {
  provider: 'openrouter';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface MiniMaxConfig extends BaseProviderConfig {
  provider: 'minimax';
  apiKey: string;
  model: string;
}

export interface GLMConfig extends BaseProviderConfig {
  provider: 'glm';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export type ProviderConfig =
  | OpenAIConfig
  | AzureOpenAIConfig
  | GeminiConfig
  | AnthropicConfig
  | OllamaConfig
  | OpenRouterConfig
  | MiniMaxConfig
  | GLMConfig;

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface AgentStreamChunk {
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'content' | 'error' | 'done';
  reasoning?: string;
  content?: string;
  toolCall?: ToolCallInfo;
  error?: string;
}


