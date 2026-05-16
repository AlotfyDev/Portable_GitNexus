import { AzureChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderConfig, AzureOpenAIConfig } from '../types.js';
import type { LLMProvider, LLMCapabilities } from '../LLMProvider.js';
import { llmModelRegistry } from '../model-registry.js';

export class AzureOpenAIProvider implements LLMProvider {
  readonly name = 'azure-openai';
  readonly capabilities: LLMCapabilities = {
    streaming: true, tools: true, vision: true,
    structuredOutput: true, maxTokens: 16384,
  };
  createModel(config: ProviderConfig): BaseChatModel {
    const c = config as AzureOpenAIConfig;
    const instanceName = extractInstanceName(c.endpoint);
    return new AzureChatOpenAI({
      modelName: c.model, temperature: c.temperature,
      azureOpenAIApiKey: c.apiKey, azureOpenAIApiInstanceName: instanceName,
      azureOpenAIApiDeploymentName: c.deploymentName,
      azureOpenAIApiVersion: c.apiVersion ?? '2024-02-15-preview',
      maxTokens: c.maxTokens ?? this.capabilities.maxTokens,
    });
  }
  supportedModels(): string[] { return llmModelRegistry.getModels('azure-openai').map(m => m.modelId); }
  supportsStreaming(): boolean { return this.capabilities.streaming; }
  supportsTools(): boolean { return this.capabilities.tools; }
}

function extractInstanceName(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname;
    const match = hostname.match(/^([^.]+)\.openai\.azure\.com$/);
    if (match) return match[1];
    return hostname.split('.')[0];
  } catch {
    return endpoint;
  }
}
