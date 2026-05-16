import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig } from './types.js';

export interface LLMCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  structuredOutput: boolean;
  maxTokens: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly capabilities: LLMCapabilities;
  createModel(config: ProviderConfig): BaseChatModel;
  supportedModels(): string[];
  supportsStreaming(): boolean;
  supportsTools(): boolean;
}
