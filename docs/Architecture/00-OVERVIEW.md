# Architecture Overview — GitNexus SSOT Monorepo

**Last updated:** 2026-05-15
**Source:** Verified against `src/core/pipeline-contract/`, `src/cli/`, `src/mcp/`, `src/server/`, `ui/src/`

---

## 1. Layered Architecture (3-Layer Model)

GitNexus follows a strict **Separation of Concerns** organized as three layers communicating through well-defined boundaries. All business logic lives in the middle layer; presentation adapters (CLI, MCP, Web UI) are thin ports that delegate to it.

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│  (Ports / Adapters — thin, no business logic)               │
│                                                             │
│  CLI (Commander)    MCP (stdio/SSE)    Web UI (React/Vite)  │
│  src/cli/ (23cmds)  src/mcp/ (7 files)  ui/src/            │
│  Thin wrappers       Tool dispatch      Pure HTTP client   │
│  NO pipeline code    NO analysis        w/ viz deps only   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                  BUSINESS LOGIC LAYER                       │
│  (Unified Core — independent of presentation)               │
│                                                             │
│  PipelineContract System (Meta-Pipeline)                    │
│  src/core/pipeline-contract/ (6 files + 5 impl/)            │
│  ├── Indexing Pipeline    (5 stages, DAG-scheduled)         │
│  ├── Boost Pipeline       (LLM enrich — target, from UI)    │
│  └── Query Pipeline       (RAG / search — target, from UI)  │
│                                                             │
│  Post-Pipeline Processors (target: extract from UI)         │
│  ├── Cluster Enricher     (LLM naming — in UI today)        │
│  ├── Graph Layout Calc    (force-directed — in UI today)    │
│  └── Node Desc Generator  (LLM descriptions — in UI today)  │
│                                                             │
│  Cross-Cutting: PortabilityContract                        │
│  src/core/portability/contract.ts — feature flags           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                 DATA / STORAGE / CACHE LAYER                │
│                                                             │
│  LadybugDB (@ladybugdb/core ^0.16.1)                        │
│  ├── Graph store (nodes + edges via Cypher)                 │
│  ├── FTS indexes (BM25 on File, Function, Class, etc.)     │
│  └── Vector index (ONNX embeddings for semantic search)     │
│                                                             │
│  meta.json — artifact fingerprints, stats, capabilities     │
│  Registry (~/.gitnexus/registry.json) — indexed repos       │
│  ONNX model cache (e5-small, ~690MB)                       │
└─────────────────────────────────────────────────────────────┘
```

### Why 3 Layers?

| Concern | Layer | Location |
|---------|-------|----------|
| User interaction (terminal, HTTP, IDE protocol) | Presentation | `src/cli/`, `src/mcp/`, `ui/` |
| Domain logic (indexing, embeddings, search, RAG) | Business Logic | `src/core/` |
| Persistent state (graph DB, files, config) | Data/Storage | `src/core/lbug/`, `src/storage/` |

The architecture follows **Hexagonal Architecture (Ports/Adapters)**: the Business Logic layer defines ports (interfaces like `PipelineContract<T>`, `EmbeddingProvider`), and the Presentation layer provides adapters that call into these ports. The Data layer is a driven adapter — the core depends on it, not vice versa.

---

## 2. Current Status

### Implemented and Verified

| Component | Status | Evidence |
|-----------|--------|----------|
| PipelineContract system (5 stages) | Done | `src/core/pipeline-contract/` — 6 files + 5 concretes |
| run-analyze.ts orchestrator (~594 → 154 lines) | Refactored | `src/core/run-analyze.ts` delegates to PipelineRunner |
| CLI commands (23 files) | Done | `src/cli/` — analyze, serve, mcp, wiki, group, tool, etc. |
| MCP server (11 tools) | Done | `src/mcp/server.ts` + `tools.ts` — stdio protocol |
| Express HTTP API (10 route modules) | Done | `src/server/routes/` — query, search, graph, analyze, etc. |
| Ingestion pipeline (14-phase DAG) | Done | `src/core/ingestion/pipeline-phases/runner.ts` — Kahn's algorithm |
| Embeddings (ONNX CPU) | Done | `src/core/embeddings/` — model, chunk, embed, index |
| LadybugDB adapter | Done | `src/core/lbug/lbug-adapter/` — query, stream, batch |
| PortabilityContract | Done | `src/core/portability/contract.ts` — DevContract + PortableContract |
| Web UI (React/Vite HTTP client) | Done | `ui/src/services/backend-client.ts` — 895 lines, HTTP only |

### In Progress / Target

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Boost Pipeline (LLM enrich) | Target | Extract cluster-enricher from `ui/src/core/ingestion/` into Business Logic |
| Query Pipeline (RAG/search) | Target | Extract LangChain agent from `ui/src/core/llm/agent.ts` into Business Logic |
| Graph Layout Calculator | Target | Move from UI into Post-Pipeline Processor |
| Node Description Generator | Target | Move from UI into Post-Pipeline Processor |
| GraphDB abstraction | Target | Define `GraphDatabaseProvider` interface (currently LadybugDB is hard-coded) |
| Parser abstraction | Target | Tree-sitter is hard-coded in 17+ files |
| TypeScript version alignment | TODO | Shared `^6.0.3` vs Root/UI `^5.4.5` — non-overlapping semver |

---

## 3. Sub-Document Index

| Document | Path | Content |
|----------|------|---------|
| Presentation Layer | `01-LAYERS/01-Presentation-Layer.md` | CLI, MCP, Web UI — commands, tools, violations |
| Business Logic Layer | `01-LAYERS/02-Business-Logic-Layer.md` | PipelineContract, sub-pipelines, processors, RAG agent |
| Data / Storage Layer | `01-LAYERS/03-Data-Storage-Layer.md` | LadybugDB, meta.json, registry, model cache |

---

## 4. Verification References

| Report | Lines | Source |
|--------|-------|--------|
| Unified Consolidated Report | 375 | `.temp_Orchestrator_HandOffs/analysis-00-unified-consolidated-report.md` |
| Architecture Context | 243 | `.temp_Orchestrator_HandOffs/analysis-02-architecture-context.md` |
| Dependency Matrix | 392 | `.temp_Orchestrator_HandOffs/analysis-01-dependency-matrix.md` |
| Cross-Layer Dependencies | 132 | `docs/.GitNexus_KG/00.01_Layers_Domains/18-cross-layer-deps.mmd` |
| Pipeline Architecture Flow | 433 | `docs/.GitNexus_KG/00.00_Holistic_Views/08-pipeline-architecture-flow-map.md` |
