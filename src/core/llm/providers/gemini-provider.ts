import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, GeminiConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: true,
    structuredOutput: false, maxTokens: 8192,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as GeminiConfig;
    return new ChatGoogleGenerativeAI({ model: c.model, temperature: c.temperature, apiKey: c.apiKey, maxOutputTokens: c.maxTokens ?? this.capabilities.maxTokens });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('gemini').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
