import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, GLMConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class GLMProvider implements LLMProvider {
  readonly name = 'glm';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: false,
    structuredOutput: false, maxTokens: 8192,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as GLMConfig;
    return new ChatOpenAI({
      modelName: c.model, temperature: c.temperature,
      openAIApiKey: c.apiKey, maxTokens: c.maxTokens ?? this.capabilities.maxTokens,
      configuration: { baseURL: c.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4' },
    });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('glm').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}
