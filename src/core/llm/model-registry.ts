export interface LLMModelConfig {
  /** Provider-specific model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  modelId: string;
  /** Optional HuggingFace hub model ID (for download/pull) */
  hubModelId?: string;
  /** Context window size in tokens */
  contextWindow?: number;
  /** Whether the model supports vision/image inputs */
  supportsVision?: boolean;
  /** Whether the model supports tool/function calling */
  supportsTools?: boolean;
  /** Whether the model supports structured JSON output */
  supportsStructuredOutput?: boolean;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Human-readable description */
  description?: string;
}

export interface LLMModelRegistry {
  /** Register model(s) for a provider */
  register(provider: string, ...models: LLMModelConfig[]): void;
  /** Get all models for a provider */
  getModels(provider: string): LLMModelConfig[];
  /** Get a specific model by provider + modelId */
  getModel(provider: string, modelId: string): LLMModelConfig | undefined;
  /** Check if a provider has a specific model */
  hasModel(provider: string, modelId: string): boolean;
}

export class DefaultLLMModelRegistry implements LLMModelRegistry {
  private models = new Map<string, LLMModelConfig[]>();

  register(provider: string, ...models: LLMModelConfig[]): void {
    const existing = this.models.get(provider) ?? [];
    existing.push(...models);
    this.models.set(provider, existing);
  }

  getModels(provider: string): LLMModelConfig[] {
    return this.models.get(provider) ?? [];
  }

  getModel(provider: string, modelId: string): LLMModelConfig | undefined {
    return this.models.get(provider)?.find(m => m.modelId === modelId);
  }

  hasModel(provider: string, modelId: string): boolean {
    return this.getModel(provider, modelId) !== undefined;
  }
}

export const llmModelRegistry: LLMModelRegistry = new DefaultLLMModelRegistry();

// ── OpenAI ──
llmModelRegistry.register('openai',
  { modelId: 'gpt-4', contextWindow: 8192, supportsVision: false, supportsTools: true, supportsStructuredOutput: true, maxTokens: 4096 },
  { modelId: 'gpt-4-turbo', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 4096 },
  { modelId: 'gpt-4o', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 16384 },
  { modelId: 'gpt-4o-mini', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 16384 },
  { modelId: 'gpt-3.5-turbo', contextWindow: 16385, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
);

// ── Azure OpenAI ──
llmModelRegistry.register('azure-openai',
  { modelId: 'gpt-4', contextWindow: 8192, supportsVision: false, supportsTools: true, supportsStructuredOutput: true, maxTokens: 4096 },
  { modelId: 'gpt-4-turbo', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 4096 },
  { modelId: 'gpt-4o', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 16384 },
  { modelId: 'gpt-4o-mini', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 16384 },
  { modelId: 'gpt-3.5-turbo', contextWindow: 16385, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
);

// ── Gemini ──
llmModelRegistry.register('gemini',
  { modelId: 'gemini-pro', contextWindow: 30720, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
  { modelId: 'gemini-1.5-pro', contextWindow: 1048576, supportsVision: true, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
  { modelId: 'gemini-1.5-flash', contextWindow: 1048576, supportsVision: true, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
);

// ── Anthropic ──
llmModelRegistry.register('anthropic',
  { modelId: 'claude-3-opus', contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
  { modelId: 'claude-3-sonnet', contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
  { modelId: 'claude-3-haiku', contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
);

// ── Ollama ──
llmModelRegistry.register('ollama',
  { modelId: 'llama3', contextWindow: 8192, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
  { modelId: 'mistral', contextWindow: 8192, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
  { modelId: 'codellama', contextWindow: 16384, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 4096 },
  { modelId: 'neural-chat', contextWindow: 4096, supportsVision: false, supportsTools: false, supportsStructuredOutput: false, maxTokens: 4096 },
);

// ── OpenRouter ──
llmModelRegistry.register('openrouter',
  { modelId: 'openrouter/auto', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: true, maxTokens: 16384 },
);

// ── MiniMax ──
llmModelRegistry.register('minimax',
  { modelId: 'minimax-pro', contextWindow: 16384, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
  { modelId: 'minimax-pro-32k', contextWindow: 32768, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
);

// ── GLM ──
llmModelRegistry.register('glm',
  { modelId: 'glm-4', contextWindow: 128000, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
  { modelId: 'glm-4v', contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
  { modelId: 'glm-3-turbo', contextWindow: 128000, supportsVision: false, supportsTools: true, supportsStructuredOutput: false, maxTokens: 8192 },
);
