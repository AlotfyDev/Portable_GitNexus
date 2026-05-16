import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, AnthropicConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: true,
    structuredOutput: false, maxTokens: 8192,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as AnthropicConfig;
    return new ChatAnthropic({ modelName: c.model, temperature: c.temperature, anthropicApiKey: c.apiKey, maxTokens: c.maxTokens ?? this.capabilities.maxTokens });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('anthropic').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
