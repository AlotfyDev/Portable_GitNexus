/**
 * @deprecated This barrel has zero external consumers. Import directly from submodule paths.
 *
 * LLM Module Exports
 *
 * Provides Graph RAG agent capabilities for code analysis.
 */

// Types
export * from './types.js';

// Agent
export {
  createChatModel,
  createGraphRAGAgent,
  streamAgentResponse,
  invokeAgent,
  BASE_SYSTEM_PROMPT,
  type AgentMessage,
} from './graph-rag-agent.js';

// Context Builder
export {
  buildCodebaseContext,
  formatContextForPrompt,
  buildDynamicSystemPrompt,
  type CodebaseContext,
  type CodebaseStats,
  type Hotspot,
} from './context-builder.js';

// Tools
export { createGraphRAGTools, type GraphRAGBackend } from './tools.js';
export type { EnrichedSearchResult, GrepResult } from './tools.js';

// LLM Provider Pattern
export { LLMProviderRegistry } from './registry.js';
export type { LLMProvider, LLMCapabilities } from './LLMProvider.js';

// Model Registry
export type { LLMModelConfig, LLMModelRegistry } from './model-registry.js';
export { DefaultLLMModelRegistry, llmModelRegistry } from './model-registry.js';
