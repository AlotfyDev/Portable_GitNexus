/**
 * Graph RAG Agent Factory
 *
 * Creates a LangChain agent configured for code graph analysis.
 * Supports Azure OpenAI and Google Gemini providers.
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMProviderRegistry } from './registry.js';
import { createGraphRAGTools, type GraphRAGBackend } from './tools.js';
import type {
  ProviderConfig,
  AgentStreamChunk,
} from './types.js';
import { type CodebaseContext, buildDynamicSystemPrompt } from './context-builder.js';

const DEV = typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production';

export const BASE_SYSTEM_PROMPT = `You are Nexus, a Code Analysis Agent with access to a Knowledge Graph. Your responses MUST be grounded.

## MANDATORY: GROUNDING
Every factual claim MUST include a citation.
- File refs: [[src/auth.ts:45-60]] (line range with hyphen)
- NO citation = NO claim. Say "I didn't find evidence" instead of guessing.

## MANDATORY: VALIDATION
Every output MUST be validated.
- Use cypher to validate the results and confirm completeness of context before final output.
- NO validation = NO claim. Say "I didn't find evidence" instead of guessing.
- Do not blindly trust readme or single source of truth. Always validate and cross-reference.

## CORE PROTOCOL
You are an investigator. For each question:
1. **Search** → Use cypher, search or grep to find relevant code
2. **Read** → Use read to see the actual source
3. **Trace** → Use cypher to follow connections in the graph
4. **Cite** → Ground every finding with [[file:line]] or [[Type:Name]]
5. **Validate** → Use cypher to validate the results and confirm completeness of context before final output. ( MUST DO )

## TOOLS
- **\`search\`** — Hybrid search. Results grouped by process with cluster context.
- **\`cypher\`** — Cypher queries against the graph. Use \`{{QUERY_VECTOR}}\` for vector search.
- **\`grep\`** — Regex search. Best for exact strings, TODOs, error codes.
- **\`read\`** — Read file content. Always use after search/grep to see full code.
- **\`explore\`** — Deep dive on a symbol, cluster, or process. Shows membership, participation, connections.
- **\`overview\`** — Codebase map showing all clusters and processes.
- **\`impact\`** — Impact analysis. Shows affected processes, clusters, and risk level.

## GRAPH SCHEMA
Nodes: File, Folder, Function, Class, Interface, Method, Community, Process
Relations: \`CodeRelation\` with \`type\` property: CONTAINS, DEFINES, IMPORTS, CALLS, EXTENDS, IMPLEMENTS, MEMBER_OF, STEP_IN_PROCESS

## GRAPH SEMANTICS (Important!)
**Edge Types:**
- \`CALLS\`: Method invocation OR constructor injection. If A receives B as parameter and uses it, A->B is CALLS. This is intentional simplification.
- \`IMPORTS\`: File-level import/include statement.
- \`EXTENDS/IMPLEMENTS\`: Class inheritance.

**Process Nodes:**
- Process labels use format: "EntryPoint → Terminal" (e.g., "onCreate → showToast")
- These are heuristic names from tracing execution flow, NOT application-defined names
- Entry points are detected via export status, naming patterns, and framework conventions

Cypher examples:
- \`MATCH (f:Function) RETURN f.name LIMIT 10\`
- \`MATCH (f:File)-[:CodeRelation {type: 'IMPORTS'}]->(g:File) RETURN f.name, g.name\`

## CRITICAL RULES
- **impact output is trusted.** Do NOT re-validate with cypher. Optionally run the suggested grep commands for dynamic patterns.
- **Cite or retract.** Never state something you can't ground.
- **Read before concluding.** Don't guess from names alone.
- **Retry on failure.** If a tool fails, fix the input and try again.
- **Cyfer tool validation** prefer using cyfer tool in anything that requires graph connections.
- **OUTPUT STYLE** Prefer using tables and mermaid diagrams instead of long explanations.
- ALWAYS USE MERMAID FOR VISUALIZATION AND STRUCTURING THE OUTPUT.

## OUTPUT STYLE
Think like a senior architect. Be concise—no fluff, short, precise and to the point.
- Use tables for comparisons/rankings
- Use mermaid diagrams for flows/dependencies
- Surface deep insights: patterns, coupling, design decisions
- End with **TL;DR** (short summary of the response, summing up the response and the most critical parts)

## MERMAID RULES
When generating diagrams:
- NO special characters in node labels: quotes, (), /, &, <, >
- Wrap labels with spaces in quotes: A["My Label"]
- Use simple IDs: A, B, C or auth, db, api
- Flowchart: graph TD or graph LR (not flowchart)
- Always test mentally: would this parse?

BAD:  A[User's Data] --> B(Process & Save)
GOOD: A["User Data"] --> B["Process and Save"]
`;

export const createChatModel = (config: ProviderConfig): BaseChatModel => {
  const provider = LLMProviderRegistry.create(config);
  return provider.createModel(config);
};

export const createGraphRAGAgent = (
  config: ProviderConfig,
  backend: GraphRAGBackend,
  codebaseContext?: CodebaseContext,
): ReturnType<typeof createReactAgent> => {
  const model = createChatModel(config);
  const tools = createGraphRAGTools(backend);

  const systemPrompt = codebaseContext
    ? buildDynamicSystemPrompt(BASE_SYSTEM_PROMPT, codebaseContext)
    : BASE_SYSTEM_PROMPT;

  if (DEV) {
    console.log('AGENT SYSTEM PROMPT:\n', systemPrompt);
  }

  const agent = createReactAgent({
    llm: model as any,
    tools: tools as any,
    messageModifier: new SystemMessage(systemPrompt) as any,
  });

  return agent;
};

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function* streamAgentResponse(
  agent: ReturnType<typeof createReactAgent>,
  messages: AgentMessage[],
): AsyncGenerator<AgentStreamChunk> {
  try {
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const stream = await agent.stream({ messages: formattedMessages }, {
      streamMode: ['values', 'messages'] as any,
      recursionLimit: 50,
    } as any);

    const yieldedToolCalls = new Set<string>();
    const yieldedToolResults = new Set<string>();
    let lastProcessedMsgCount = formattedMessages.length;
    let pendingToolCalls = 0;
    let hasSeenToolCallThisTurn = false;

    for await (const event of stream) {
      let mode: string;
      let data: any;

      if (Array.isArray(event) && event.length === 2 && typeof event[0] === 'string') {
        [mode, data] = event;
      } else if (Array.isArray(event) && event[0]?._getType) {
        mode = 'messages';
        data = event;
      } else {
        mode = 'values';
        data = event;
      }

      if (DEV) {
        const msgType = (mode === 'messages' && data?.[0]?._getType?.()) || 'n/a';
        const hasContent = mode === 'messages' && data?.[0]?.content;
        const hasToolCalls = mode === 'messages' && data?.[0]?.tool_calls?.length > 0;
        console.log(`[${mode}] type:${msgType} content:${!!hasContent} tools:${hasToolCalls}`);
      }

      if (mode === 'messages') {
        const [msg] = Array.isArray(data) ? data : [data];
        if (!msg) continue;

        const msgType = msg._getType?.() || msg.type || msg.constructor?.name || 'unknown';

        if (msgType === 'ai' || msgType === 'AIMessage' || msgType === 'AIMessageChunk') {
          const rawContent = msg.content;
          const toolCalls = msg.tool_calls || [];

          let content: string = '';
          if (typeof rawContent === 'string') {
            content = rawContent;
          } else if (Array.isArray(rawContent)) {
            content = rawContent
              .filter((block: any) => block.type === 'text' || typeof block === 'string')
              .map((block: any) => (typeof block === 'string' ? block : block.text || ''))
              .join('');
          }

          if (content && content.length > 0) {
            const isReasoning =
              !hasSeenToolCallThisTurn || toolCalls.length > 0 || pendingToolCalls > 0;
            yield {
              type: isReasoning ? 'reasoning' : 'content',
              [isReasoning ? 'reasoning' : 'content']: content,
            };
          }

          if (toolCalls.length > 0) {
            hasSeenToolCallThisTurn = true;
            pendingToolCalls += toolCalls.length;
            for (const tc of toolCalls) {
              const toolId = tc.id || `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              if (!yieldedToolCalls.has(toolId)) {
                yieldedToolCalls.add(toolId);
                let parsedArgs: Record<string, any>;
                try {
                  parsedArgs = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
                } catch {
                  parsedArgs = {};
                }
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolId,
                    name: tc.name || tc.function?.name || 'unknown',
                    args: tc.args || parsedArgs,
                    status: 'running',
                  },
                };
              }
            }
          }
        }

        if (msgType === 'tool' || msgType === 'ToolMessage') {
          const toolCallId = msg.tool_call_id || '';
          if (toolCallId && !yieldedToolResults.has(toolCallId)) {
            yieldedToolResults.add(toolCallId);
            const result =
              typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            yield {
              type: 'tool_result',
              toolCall: {
                id: toolCallId,
                name: msg.name || 'tool',
                args: {},
                result: result,
                status: 'completed',
              },
            };
            pendingToolCalls = Math.max(0, pendingToolCalls - 1);
          }
        }
      }

      if (mode === 'values' && data?.messages) {
        const stepMessages = data.messages || [];

        for (let i = lastProcessedMsgCount; i < stepMessages.length; i++) {
          const msg = stepMessages[i];
          const msgType = msg._getType?.() || msg.type || 'unknown';

          if ((msgType === 'ai' || msgType === 'AIMessage') && !yieldedToolCalls.size) {
            const toolCalls = msg.tool_calls || [];
            for (const tc of toolCalls) {
              const toolId = tc.id || `tool-${Date.now()}`;
              if (!yieldedToolCalls.has(toolId)) {
                pendingToolCalls++;
                yieldedToolCalls.add(toolId);
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolId,
                    name: tc.name || 'unknown',
                    args: tc.args || {},
                    status: 'running',
                  },
                };
              }
            }
          }

          if (msgType === 'tool' || msgType === 'ToolMessage') {
            const toolCallId = msg.tool_call_id || '';
            if (toolCallId && !yieldedToolResults.has(toolCallId)) {
              yieldedToolResults.add(toolCallId);
              const result =
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
              yield {
                type: 'tool_result',
                toolCall: {
                  id: toolCallId,
                  name: msg.name || 'tool',
                  args: {},
                  result: result,
                  status: 'completed',
                },
              };
              pendingToolCalls = Math.max(0, pendingToolCalls - 1);
            }
          }
        }

        lastProcessedMsgCount = stepMessages.length;
      }
    }

    yield { type: 'done' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield { type: 'error', error: message };
  }
}

export const invokeAgent = async (
  agent: ReturnType<typeof createReactAgent>,
  messages: AgentMessage[],
): Promise<string> => {
  const formattedMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await agent.invoke({ messages: formattedMessages });

  const lastMessage = result.messages[result.messages.length - 1];
  return lastMessage?.content?.toString() ?? 'No response generated.';
};
