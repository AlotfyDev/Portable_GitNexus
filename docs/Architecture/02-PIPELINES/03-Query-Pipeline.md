# Query Pipeline — Read-Only Serving Interface (Proposed)

**Last updated:** 2026-05-15
**Status:** ⚠️ **TARGET STATE** — This describes a proposed unified query interface. The components below are partially implemented in disparate locations today (direct LadybugDB calls in `src/server/routes/`, `src/mcp/`, and the LangGraph agent in `ui/src/core/llm/agent.ts`). No `QueryPipeline` abstraction exists in `src/core/` yet.

---

## 1. Purpose

The Query Pipeline provides a unified, read-only query interface for all presentation layers (CLI, MCP, Web UI). It encapsulates the various query modalities (Cypher, FTS, vector, hybrid, agentic) behind a single abstraction, eliminating the current pattern of each presentation layer calling LadybugDB directly.

```
                     ┌──────────────────────────────────┐
                     │       QUERY PIPELINE              │
                     │       (read-only, no cache)       │
                     │                                   │
                     │  ┌──────────────────────────┐    │
                     │  │  Cypher Query Executor    │    │
                     │  │  (direct graph queries)   │    │
                     │  ├──────────────────────────┤    │
                     │  │  FTS Search (BM25)        │    │
                     │  │  (File, Function, Class)  │    │
                     │  ├──────────────────────────┤    │
                     │  │  Vector Search             │    │
                     │  │  (semantic, via ONNX)     │    │
                     │  ├──────────────────────────┤    │
                     │  │  Hybrid Search             │    │
                     │  │  (BM25 + vector reranking)│    │
                     │  ├──────────────────────────┤    │
                     │  │  Graph RAG Agent           │    │
                     │  │  (LangGraph reasoning)    │    │
                     │  └──────────────────────────┘    │
                     └──────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼──┐  ┌────▼───┐  ┌───▼──────┐
              │  CLI   │  │  MCP   │  │  Web UI  │
              │(direct)│  │(server)│  │ (HTTP)   │
              └────────┘  └────────┘  └──────────┘
```

---

## 2. Proposed Interface

```typescript
// Proposed — does not exist in codebase yet

interface QueryPipeline {
  /** Cypher query execution against the knowledge graph */
  cypher<T = Record<string, unknown>>(query: string, params?: Record<string, unknown>): Promise<T[]>;

  /** Full-text search using BM25 */
  fts(query: string, options?: FTSOptions): Promise<FTSResult[]>;

  /** Vector (semantic) search */
  vector(query: string, k?: number, maxDistance?: number): Promise<VectorSearchResult[]>;

  /** Hybrid search: BM25 + vector with score fusion */
  hybrid(query: string, options?: HybridOptions): Promise<HybridResult[]>;

  /** Graph RAG query with LLM reasoning */
  rag(query: string, context?: RAGContext): Promise<RAGResponse>;

  /** Repository overview (clusters, processes, stats) */
  overview(): Promise<CodebaseOverview>;

  /** Impact analysis for a symbol */
  impact(symbolName: string, direction?: 'upstream' | 'downstream'): Promise<ImpactResult>;

  /** Explore a symbol, cluster, or process in depth */
  explore(target: string, type?: 'symbol' | 'cluster' | 'process'): Promise<ExploreResult>;
}
```

---

## 3. Query Components

### 3.1 Cypher Query Executor

**Status: Implemented** — accessed via `@ladybugdb/core` adapter functions (`executeQuery`, `executeWithReusedStatement`).

Cypher queries run directly against the LadybugDB graph store. This is the lowest-level query primitive — all other query types either use Cypher internally or post-process its results.

### 3.2 FTS Search (BM25)

**Status: Implemented** — `createSearchFTSIndexes()` at `src/core/search/fts-indexes.js` creates indexes during indexing. FTS queries use BM25 scoring.

**Indexed node types:** File, Function, Class, Interface

The FTS indexes are created by the SEARCH stage of the Indexing Pipeline. Querying them requires Cypher with `CONTAINS` or native LadybugDB FTS functions.

### 3.3 Vector Search

**Status: Implemented** — `semanticSearch()` at `src/core/embeddings/embedding-pipeline.ts:501-659`

```typescript
export const semanticSearch = async (
  queryExecutorOrRepo,
  query: string,        // natural language query
  k: number = 10,       // top-K results
  maxDistance: number = 0.5,  // cosine distance threshold
): Promise<SemanticSearchResult[]>
```

Supports two modes:
1. **Vector index** — `CALL QUERY_VECTOR_INDEX(...)` for fast approximate nearest neighbor search
2. **Exact scan** — loads all embeddings into memory and ranks by cosine distance (fallback when vector extension unavailable)

Also has `semanticSearchWithContext()` at `embedding-pipeline.ts:664-683` for graph-expanded results (one-hop neighbors).

### 3.4 Hybrid Search

**Status: Partially implemented.** BM25 FTS and vector search exist independently. A unified hybrid search that fuses both score types does not exist yet as a single query path. The proposed implementation:

```typescript
async hybridSearch(query: string, options: HybridOptions = {}): Promise<HybridResult[]> {
  const ftsResults = await ftsSearch(query, { limit: options.ftsLimit ?? 50 });
  const vectorResults = await semanticSearch(/*...*/, query, options.vectorK ?? 20);

  // Reciprocal Rank Fusion (RRF)
  const fused = fuseByRRF(ftsResults, vectorResults, { k: options.rrfK ?? 60 });
  return fused.slice(0, options.topK ?? 10);
}
```

### 3.5 Graph RAG Agent

**Status: ⚠️ In UI (to be moved).** `ui/src/core/llm/agent.ts:1-574`

The Graph RAG Agent is a LangGraph-based React agent that uses an LLM (OpenAI, Anthropic, Gemini, Ollama, OpenRouter, etc.) to answer questions about the codebase by dynamically selecting which tools to use.

#### Agent Architecture

```
createGraphRAGAgent(config, backend, codebaseContext?)
├── createChatModel(config)
│   ├── Provider dispatch: openai | azure-openai | gemini | anthropic | ollama | openrouter | minimax | glm
│   └── Returns BaseChatModel (streaming enabled)
├── createGraphRAGTools(backend)  ← from ui/src/core/llm/tools.ts
│   └── 7 tools:
│       ├── search       — Hybrid search (FTS + vector, process-grouped results)
│       ├── cypher       — Raw Cypher queries against LadybugDB
│       ├── grep         — Regex search in file system
│       ├── read         — Read file content by path
│       ├── overview     — Codebase map (clusters + processes)
│       ├── explore      — Deep dive on symbol/cluster/process
│       └── impact       — Impact analysis (upstream/downstream)
├── buildDynamicSystemPrompt()  ← from ui/src/core/llm/context-builder.ts
│   └── Injects repo context: name, structure, conventions
├── createReactAgent({model, tools, messageModifier})
│   └── Returns LangGraph CompiledRunnable (ReactAgentNode)
```

#### Current Tool Backend

The agent's tools currently communicate via HTTP through `ui/src/services/backend-client.ts`:

```
Agent Tool → backend-client.ts (axios) → Express HTTP API → LadybugDB
```

**Target state (in Business Logic Layer):**

```
Agent Tool → LadybugDB adapter (direct) → LadybugDB
```

This eliminates the HTTP round-trip, making the agent faster and removing the dependency on `gitnexus serve` being available.

#### Supported LLM Providers (`agent.ts:128-270`)

| Provider | Class | Config Fields |
|----------|-------|---------------|
| OpenAI | `ChatOpenAI` | apiKey, model, temperature, maxTokens, baseUrl |
| Azure OpenAI | `AzureChatOpenAI` | apiKey, endpoint, deploymentName, apiVersion |
| Google Gemini | `ChatGoogleGenerativeAI` | apiKey, model, temperature, maxOutputTokens |
| Anthropic | `ChatAnthropic` | apiKey, model, temperature, maxTokens |
| Ollama | `ChatOllama` | baseUrl, model, temperature, numPredict, numCtx |
| OpenRouter | `ChatOpenAI` | apiKey, model, baseUrl (default: openrouter.ai) |
| MiniMax | `ChatAnthropic` | apiKey, model (via Anthropic-compatible API) |
| GLM (Zhipu AI) | `ChatOpenAI` | apiKey, model, baseUrl |

#### Streaming Response (`agent.ts:340-554`)

The agent supports dual-mode streaming:
- **`'values'`** mode — state snapshots (tool calls, results in proper order)
- **`'messages'`** mode — token-by-token text streaming

The `streamAgentResponse` async generator:
1. Interleaves reasoning text, tool calls, tool results, and final content
2. Deduplicates tool calls via `yieldedToolCalls`/`yieldedToolResults` sets
3. Tracks `pendingToolCalls` to distinguish reasoning-from-final content
4. Has `recursionLimit: 50` for long agentic loops

#### Files to Move (from UI to Root)

| Current Path | Lines | Target Path |
|-------------|-------|-------------|
| `ui/src/core/llm/agent.ts` | 574 | `src/core/llm/agent.ts` |
| `ui/src/core/llm/tools.ts` | — | `src/core/llm/tools.ts` |
| `ui/src/core/llm/types.ts` | — | `src/core/llm/types.ts` |
| `ui/src/core/llm/context-builder.ts` | — | `src/core/llm/context-builder.ts` |
| `ui/src/core/llm/settings-service.ts` | — | `src/core/llm/settings-service.ts` |
| `ui/src/core/llm/index.ts` | — | `src/core/llm/index.ts` |

---

## 4. Read Path Data Flow (Target)

```mermaid
sequenceDiagram
    participant CLI as CLI User
    participant MCPC as MCP Client<br/>(Claude Code)
    participant HTTPC as HTTP Client<br/>(Web UI / curl)
    participant LBE as Local Backend<br/>(mcp/local/local-backend.ts)
    participant QP as QUERY PIPELINE<br/>(src/core/query-pipeline/)
    participant LBUG as LadybugDB
    participant FS as File System
    participant LLM as LLM Provider API

    Note over CLI,MCPC,HTTPC: PRESENTATION LAYER (Ports)

    CLI->>LBE: gitnexus query "find auth functions"
    MCPC->>LBE: MCP tool: search("auth functions")
    HTTPC->>QP: GET /api/query?q=auth+functions

    Note over LBE,QP: BUSINESS LOGIC LAYER

    alt CLI path (direct)
        LBE->>QP: queryPipeline.search("auth functions")
    else MCP path (tool dispatch)
        LBE->>QP: queryPipeline.search("auth functions")
    else HTTP path (REST API)
        HTTPC->>QP: Express route → queryPipeline
    end

    alt FTS query
        QP->>LBUG: executeQuery("MATCH (f:File) WHERE ...")
        LBUG-->>QP: BM25-scored results
    else Vector query
        QP->>QP: embedText("auth functions") → vector
        QP->>LBUG: CALL QUERY_VECTOR_INDEX(...)
        LBUG-->>QP: Nearest neighbors
    else Hybrid query
        QP->>LBUG: FTS + Vector search
        LBUG-->>QP: Raw results
        QP->>QP: RRF fusion → ranked
    else RAG query
        QP->>QP: agent.stream({messages})
        QP->>LLM: LLM call (tool-using reasoning)
        LLM-->>QP: Reasoning + Tool calls
        QP->>LBUG: tool: cypher("MATCH ...")
        QP->>FS: tool: grep("auth")
        QP->>LBUG: tool: explore("authenticate")
        LBUG-->>QP: Graph context
        FS-->>QP: File matches
        QP->>LLM: Tool results
        LLM-->>QP: Final grounded answer
    end

    QP-->>LBE: Unified QueryResult
    QP-->>HTTPC: JSON Response

    Note over LBE,QP: DATA / STORAGE LAYER
```

---

## 5. How Presentation Layers Access It

### Current State (direct LadybugDB access)

| Layer | Access Pattern | File |
|-------|---------------|------|
| CLI | Direct function calls to LadybugDB adapter | `src/cli/query.ts` |
| MCP | Tool dispatch → LadybugDB adapter | `src/mcp/tools.ts` |
| Web UI | `axios` → Express HTTP API → routes → LadybugDB | `ui/src/services/backend-client.ts`, `src/server/routes/` |
| Graph RAG Agent (UI) | LangGraph → tools → `backend-client.ts` → HTTP → routes → LadybugDB | `ui/src/core/llm/agent.ts` |

### Target State (unified Query Pipeline)

| Layer | Access Pattern | File |
|-------|---------------|------|
| CLI | `queryPipeline.search(...)` via `mcp/local/local-backend.ts` | `src/cli/query.ts` → `src/core/query-pipeline/` |
| MCP | Tool dispatch → `LocalBackend` → `queryPipeline` | `src/mcp/tools.ts` → `src/core/query-pipeline/` |
| Web UI | `axios` → Express route → `queryPipeline` | `src/server/routes/` → `src/core/query-pipeline/` |
| Graph RAG Agent | Tools → LadybugDB **directly** (no HTTP) | `src/core/llm/agent.ts` → `src/core/query-pipeline/` |

---

## 6. No Artifact Fingerprint Needed

The Query Pipeline is **read-only** — it does not produce or cache any artifacts. Every query starts from scratch against the existing LadybugDB and file system. This means:

- No `artifact.fingerprint` declarations
- No `saveArtifactFingerprint()` calls
- No freshness checks
- No `onBeforeInvalidation` hooks

The Query Pipeline is not a PipelineContract stage — it is a service consumed by presentation layers.

---

## 7. Dependencies

| Package | Current Version | Current Location | Target Location | Purpose |
|---------|----------------|-----------------|-----------------|---------|
| `@langchain/core` | ^1.1.44 | UI | Root | LangChain primitives for agent |
| `@langchain/langgraph` | ^1.2.9 | UI | Root | Agentic state machine |
| `@langchain/openai` | ^1.4.5 | UI | Root | OpenAI / OpenRouter provider |
| `@langchain/anthropic` | ^1.3.29 | UI | Root | Anthropic provider |
| `@langchain/google-genai` | ^2.1.28 | UI | Root | Gemini provider |
| `@langchain/ollama` | ^1.2.6 | UI | Root | Ollama local provider |
| `langchain` | ^1.3.5 | UI | Root | LangChain orchestration |
| `zod` | ^3.25.76 | UI | Root | Schema validation for tools |

---

## 8. Current vs Target State

| Aspect | Current | Target |
|--------|---------|--------|
| Query interface | Fragmented across CLI, MCP, HTTP, UI agent | Unified `QueryPipeline` interface |
| Graph RAG Agent | `ui/src/core/llm/agent.ts` (HTTP-based tools) | `src/core/llm/agent.ts` (direct DB access) |
| Tool backend | HTTP via `backend-client.ts` (axios) | Direct LadybugDB adapter calls |
| Hybrid search | BM25 FTS + vector search exist separately | Unified RRF-fused hybrid search |
| LLM provider packages | `ui/package.json` only | `gitnexus/package.json` (shared) |
| Settings management | `settings-service.ts` in UI | `src/core/llm/settings-service.ts` |
| Agent URL for UI | Agent runs in browser, calls backend via HTTP | Two options: agent runs server-side (stream to UI) or client-side (import as wasm) |

---

## 9. Cross-References

- **Boost Pipeline enrichments:** See `02-Boost-Pipeline.md` — Query Pipeline consumes enriched cluster names and node descriptions for better RAG context
- **Indexing Pipeline stages:** See `01-Indexing-Pipeline.md` — Query Pipeline reads data produced by all 5 indexing stages
- **Meta-Pipeline runner:** See `00-Meta-Pipeline.md:3` — the Query Pipeline does NOT use the runner (read-only service, not a stage)
- **Business Logic Layer:** See `02-Business-Logic-Layer.md:5` for the Graph RAG agent target state
- **Presentation Layer:** See `01-Presentation-Layer.md` for CLI/MCP/HTTP layer boundaries
