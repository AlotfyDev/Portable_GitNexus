import type { ProviderConfig } from './types.js';
import type { LLMProvider } from './LLMProvider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { AzureOpenAIProvider } from './providers/azure-openai-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { OllamaProvider } from './providers/ollama-provider.js';
import { OpenRouterProvider } from './providers/openrouter-provider.js';
import { MiniMaxProvider } from './providers/minimax-provider.js';
import { GLMProvider } from './providers/glm-provider.js';

type ProviderConstructor = new (config: any) => LLMProvider;

export class LLMProviderRegistry {
  private static providers = new Map<string, ProviderConstructor>();

  static register(name: string, ctor: ProviderConstructor): void {
    this.providers.set(name, ctor);
  }

  static create(config: ProviderConfig): LLMProvider {
    const ctor = this.providers.get(config.provider);
    if (!ctor) throw new Error(`Unknown LLM provider: ${config.provider}`);
    return new ctor(config);
  }
}

LLMProviderRegistry.register('openai', OpenAIProvider);
LLMProviderRegistry.register('azure-openai', AzureOpenAIProvider);
LLMProviderRegistry.register('gemini', GeminiProvider);
LLMProviderRegistry.register('anthropic', AnthropicProvider);
LLMProviderRegistry.register('ollama', OllamaProvider);
LLMProviderRegistry.register('openrouter', OpenRouterProvider);
LLMProviderRegistry.register('minimax', MiniMaxProvider);
LLMProviderRegistry.register('glm', GLMProvider);
