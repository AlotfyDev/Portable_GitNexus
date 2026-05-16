import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, OllamaConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: false,
    structuredOutput: false, maxTokens: 4096,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as OllamaConfig;
    return new ChatOllama({ model: c.model, temperature: c.temperature, baseUrl: c.baseUrl, numPredict: c.maxTokens ?? this.capabilities.maxTokens });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('ollama').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
