import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, OpenRouterConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'openrouter';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: true,
    structuredOutput: true, maxTokens: 16384,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as OpenRouterConfig;
    return new ChatOpenAI({
      modelName: c.model, temperature: c.temperature,
      openAIApiKey: c.apiKey, maxTokens: c.maxTokens ?? this.capabilities.maxTokens,
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('openrouter').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
