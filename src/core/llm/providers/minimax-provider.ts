import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, MiniMaxConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class MiniMaxProvider implements LLMProvider {
  readonly name = 'minimax';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: false,
    structuredOutput: false, maxTokens: 8192,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as MiniMaxConfig;
    return new ChatAnthropic({
      modelName: c.model, temperature: c.temperature,
      anthropicApiKey: c.apiKey, maxTokens: c.maxTokens ?? this.capabilities.maxTokens,
      anthropicApiUrl: 'https://api.minimax.example.com/v1',
    });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('minimax').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
