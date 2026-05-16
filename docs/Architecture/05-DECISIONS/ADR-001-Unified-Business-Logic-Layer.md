# ADR-001: Separate Presentation from Business Logic via Hexagonal Architecture

**Status:** Accepted
**Date:** 2026-05-15
**Deciders:** Architecture Team (Agents 1–4)
**Tags:** architecture, hexagonal, layering, ports-and-adapters

---

## Context

The GitNexus codebase evolved organically, with business logic scattered across three presentation contexts:

1. **CLI** (`src/cli/`) — Commander-based commands that historically contained pipeline DAG construction and LadybugDB calls
2. **MCP** (`src/mcp/local/helpers/`) — 14 helper files that directly import LadybugDB adapter functions (`executeQuery`, `executeParameterized`, `searchFTSFromLbug`) and orchestrate query composition (BM25 + vector fusion, impact analysis BFS, context aggregation)
3. **Web UI** (`ui/src/core/`) — A LangChain-based Graph RAG agent (574 lines), a cluster enricher (243 lines), and graph layout calculations, all living in UI-layer code but performing business logic functions

This scattering created several structural problems:
- **Duplicated logic** — The MCP helpers and Web UI agent both performed hybrid search composition, but with different code paths
- **Impossible to test** — Business logic in the UI was only testable via browser integration tests
- **Wrong dependency category** — UI owned `@langchain/*` packages (7 packages, ~15+ MB) that were used for server-side LLM orchestration
- **Fragmented data access** — CLI, MCP, and HTTP server all called LadybugDB directly, bypassing any unified query interface
- **Impossible to swap** — Because LadybugDB was imported directly by 3 different presentation contexts, replacing the graph database required changes in 20+ files across all layers

## Decision

Adopt **Hexagonal Architecture (Ports/Adapters)** with three strict layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER (Ports)                   │
│  CLI (Commander)     MCP (stdio/SSE)     Web UI (React)     │
│  src/cli/            src/mcp/            ui/                │
│                                                             │
│  Responsibilities:                                          │
│  - Parse user input (args, JSON-RPC, HTTP requests)         │
│  - Format output (console, JSON-RPC responses, HTML)        │
│  - Provide progress feedback (progress bars, SSE streams)   │
│  - Handle SIGINT / graceful shutdown                        │
│                                                             │
│  STRICT RULE: NO pipeline code, NO direct DB access,        │
│  NO LLM calls, NO analysis logic                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                BUSINESS LOGIC LAYER (Core)                   │
│  src/core/                                                   │
│                                                             │
│  Responsibilities:                                          │
│  - Pipeline orchestration (PipelineContract + runner)       │
│  - Code analysis (tree-sitter parsing, AST building)        │
│  - Knowledge graph construction & querying                  │
│  - Embedding generation (ONNX CPU inference)                │
│  - LLM enrichment (cluster enricher, node descriptions)     │
│  - Graph RAG agent (LangChain-based)                        │
│  - Search (BM25 FTS, vector, hybrid RRF fusion)             │
│  - Impact analysis (BFS traversal)                          │
│                                                             │
│  RULE: Independent of presentation. Defines port            │
│  interfaces (PipelineContract, EmbeddingProvider)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│             DATA / STORAGE LAYER (Driven Adapters)           │
│  @ladybugdb/core    File System    Model Cache              │
│                                                             │
│  Responsibilities:                                          │
│  - Persistent graph data (nodes, edges via Cypher)          │
│  - FTS indexes (BM25 on File, Function, Class, etc.)        │
│  - Vector index (HNSW for semantic search)                  │
│  - Metadata & registry (meta.json, registry.json)           │
│                                                             │
│  RULE: Only accessed through Business Logic adapters         │
└─────────────────────────────────────────────────────────────┘
```

### Communication Boundaries

| From | To | Mechanism | Direction |
|------|----|-----------|-----------|
| CLI | Core | Direct function call (`runFullAnalysis(...)`) | Inbound |
| CLI | Express Server | `createServer(port, host)` | Inbound |
| CLI | MCP Backend | `LocalBackend.callTool(name, args)` | Inbound |
| MCP | Core | `LocalBackend` → `QueryPipeline` (target) | Inbound |
| Web UI | Express Server | HTTP `fetch()` / `axios` | Inbound |
| Express Server | Core | Route handler → Core function | Inbound |
| Core | LadybugDB | Adapter functions (driver) | Outbound |
| Core | LLM API | HTTP (LangChain providers) | Outbound |

### What the Three Presentation Layers Must NOT Contain

- Pipeline DAG construction (belongs in `src/core/run-analyze.ts`)
- Direct LadybugDB queries (belongs in `src/core/lbug/` or `src/core/query-pipeline/`)
- Embedding model loading or inference (belongs in `src/core/embeddings/`)
- Tree-sitter parsing (belongs in `src/core/ingestion/` or `src/core/tree-sitter/`)
- LLM agent orchestration (belongs in `src/core/llm/`)
- Cluster enrichment (belongs in `src/core/boost/`)

## Consequences

### Positive

1. **Single source of truth** — All business logic lives in `src/core/`. No more duplicated search composition logic between MCP helpers and UI agent.
2. **Testable** — Business logic can be tested without browser integration tests. Pipeline stages have pure unit tests.
3. **Clean dependency graph** — Presentation layers depend on Core; Core does NOT depend on any presentation layer. Dependency direction is enforced.
4. **Swappability path** — With all business logic in one layer, replacing LadybugDB or tree-sitter becomes a single-layer refactoring instead of a cross-layer one.
5. **Reduced UI bundle** — Removing `@langchain/*` (7 packages) and `graphology-layout-*` (3 packages) from UI shrinks the bundle by ~5 MB.
6. **Server-side caching** — Graph layout calculations move from browser (recalculated on every page load) to server-side Post-Pipeline Processor (cached once, served N times).

### Negative

1. **Migration cost** — Requires moving approximately 1,000 lines of code from UI to Root:
   - `ui/src/core/llm/agent.ts` (574 lines) → `src/core/llm/agent.ts`
   - `ui/src/core/llm/tools.ts` → `src/core/llm/tools.ts`
   - `ui/src/core/llm/types.ts` → `src/core/llm/types.ts`
   - `ui/src/core/llm/context-builder.ts` → `src/core/llm/context-builder.ts`
   - `ui/src/core/llm/settings-service.ts` → `src/core/llm/settings-service.ts`
   - `ui/src/core/llm/index.ts` → `src/core/llm/index.ts`
   - `ui/src/core/ingestion/cluster-enricher.ts` (243 lines) → `src/core/boost/cluster-enricher.ts`
2. **Tool behavior change** — The Graph RAG agent's tools currently communicate via HTTP (`backend-client.ts` → Express server → LadybugDB). After migration, they call LadybugDB directly. This changes error handling, retry logic, and timeout behavior.
3. **MCP helper refactoring** — 10 of 14 MCP helper files need to delegate to the new `QueryPipeline` instead of calling LadybugDB directly. The remaining 4 (api-tools, formatting, constants) stay in MCP.
4. **Express route refactoring** — `src/server/routes/search.ts` (lines 34-150) orchestrates search mode dispatch and result enrichment in the route handler. This composition logic must move to the Query Pipeline.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing API contracts during migration | Medium | High | Feature-flag new paths; keep old paths during transition |
| Agent tool behavior changes (HTTP → direct DB) | Medium | Medium | Test all 7 tools against known queries; compare results |
| UI build breaks after removing `@langchain/*` | Low | High | Remove imports first, then packages; verify `tsc --noEmit` |
| MCP tool response format changes | Medium | Medium | Define `QueryResult` interface; serialize identically |
| Regression in streaming responses | Medium | High | Preserve `streamAgentResponse` deduplication logic exactly |

## File References

### Files Moving from UI to Root (Violation Remediation)

| Current Path | Lines | Target Path | Risk |
|-------------|-------|-------------|------|
| `ui/src/core/llm/agent.ts` | 574 | `src/core/llm/graph-rag-agent.ts` | HIGH — Tool backends change from HTTP to direct DB |
| `ui/src/core/llm/tools.ts` | ~120 | `src/core/llm/tools.ts` | HIGH — Tool implementations change |
| `ui/src/core/llm/types.ts` | ~40 | `src/core/llm/types.ts` | LOW — Pure types |
| `ui/src/core/llm/context-builder.ts` | ~60 | `src/core/llm/context-builder.ts` | MEDIUM — System prompt logic |
| `ui/src/core/llm/settings-service.ts` | ~80 | `src/core/llm/settings-service.ts` | MEDIUM — Config management |
| `ui/src/core/llm/index.ts` | ~10 | `src/core/llm/index.ts` | LOW — Barrel exports |
| `ui/src/core/ingestion/cluster-enricher.ts` | 243 | `src/core/boost/cluster-enricher.ts` | MEDIUM — Needs Boost Pipeline registration |

### MCP Helpers Moving to Query Pipeline (Target)

| Current Path | Target Path | Interface Method |
|-------------|-------------|-----------------|
| `src/mcp/local/helpers/search.ts` | `src/core/query-pipeline/search.ts` | `queryPipeline.hybrid()` |
| `src/mcp/local/helpers/context-tools.ts` | `src/core/query-pipeline/context.ts` | `queryPipeline.context()` |
| `src/mcp/local/helpers/impact.ts` | `src/core/query-pipeline/impact.ts` | `queryPipeline.impact()` |
| `src/mcp/local/helpers/detect-changes.ts` | `src/core/query-pipeline/detect-changes.ts` | `queryPipeline.detectChanges()` |
| `src/mcp/local/helpers/rename.ts` | `src/core/query-pipeline/rename.ts` | `queryPipeline.rename()` |
| `src/mcp/local/helpers/symbol-resolution.ts` | `src/core/query-pipeline/resolution.ts` | Internal helper |

### Express Routes to Refactor

| Current Path | Lines | Issue |
|-------------|-------|-------|
| `src/server/routes/search.ts` | 34-150 | Orchestrates search mode dispatch + enrichment IN the route handler |
| `src/server/routes/graph.ts` | Entire | Calls LadybugDB directly (`withLbugDb(lbugPath, buildGraph)`) |
| `src/server/routes/query.ts` | Entire | Calls LadybugDB directly (`withLbugDb(lbugPath, executeQuery)`) |

## Compliance Checklist

- [ ] CLI has zero pipeline DAG construction code
- [ ] CLI has zero direct LadybugDB queries
- [ ] MCP helpers delegate to QueryPipeline, not LadybugDB
- [ ] Web UI has no `@langchain/*` or `langchain` imports
- [ ] Web UI imports from `gitnexus-shared` are type-only (verified)
- [ ] Express routes delegate to Core, not LadybugDB directly
- [ ] All imports flow: Presentation → Business Logic → Data/Storage (never reverse)
- [ ] 10 MCP helper files refactored; 4 stay in MCP

## Cross-References

| Document | Path | Relevance |
|----------|------|-----------|
| Architecture Overview | `00-OVERVIEW.md` | 3-layer model definition |
| Presentation Layer | `01-LAYERS/01-Presentation-Layer.md` | Current violations documented |
| Business Logic Layer | `01-LAYERS/02-Business-Logic-Layer.md` | Target state for extracted code |
| MCP Adapter | `03-PORTS/02-MCP-Adapter.md` | MCP helper refactoring plan |
| Web UI Adapter | `03-PORTS/03-Web-UI-Adapter.md` | UI business logic violations |
| Dependency Matrix | `04-DEPENDENCIES/01-Dependency-Matrix.md` | Migration plan (Section E) |
