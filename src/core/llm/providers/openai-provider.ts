import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, OpenAIConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: true,
    structuredOutput: true, maxTokens: 16384,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as OpenAIConfig;
    return new ChatOpenAI({ modelName: c.model, temperature: c.temperature, openAIApiKey: c.apiKey, maxTokens: c.maxTokens ?? this.capabilities.maxTokens });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('openai').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
