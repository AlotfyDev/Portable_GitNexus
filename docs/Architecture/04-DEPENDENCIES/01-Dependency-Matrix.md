# Dependency Matrix — Organized by Architecture Layer

**Last updated:** 2026-05-15
**Source files:** `gitnexus/package.json` (lines 57–123), `ui/package.json` (lines 20–77), `shared/package.json` (lines 26–28)
**Verification:** Cross-checked against actual `node_modules/` tree, import analysis across `src/`, `ui/src/`, `shared/src/`

---

## 1. Executive Summary

This document maps every dependency to its **architecture layer** (Presentation, Business Logic, Data/Storage) per the 3-layer model defined in `00-OVERVIEW.md`. It identifies which packages are in the wrong layer and defines the migration path.

| Layer | Dependencies (direct) | Lines of Code | Key Risk |
|-------|----------------------|---------------|----------|
| Presentation (CLI + Server + MCP + Web UI) | ~50 | ~2,000+ | Leaked business logic: 8 packages in UI belong in Business Logic |
| Business Logic (Root Core) | ~45 | ~38,000+ | Hard-coded LadybugDB + tree-sitter; no provider interfaces |
| Data / Storage (LadybugDB + File System) | ~2 | ~1,500+ | No abstraction layer — 14+ adapters directly imported |

### Cross-Layer Violation Summary

| Violation | Packages | Target Layer | Migration Priority |
|-----------|----------|-------------|-------------------|
| `@langchain/*` in UI | 7 packages | Business Logic | P1 — Must move for arch integrity |
| `graphology-layout-*` in UI | 3 packages | Business Logic | P2 — Server-side layout cache |
| `tree-sitter-wasms` in UI (dead) | 1 package | Remove | P2 — Zero imports confirmed |
| `@rolldown/binding` in deps | 1 package | devDependencies | P1 — Wrong dep category |

---

## Section A: Shared Dependencies (Packages in Multiple Locations)

Packages appearing in **≥2 of 3** `package.json` files, with the **Target Layer** column indicating which layer each package should belong to after architecture cleanup.

| Package | Root (gitnexus/) | UI (ui/) | Shared (shared/) | Risk | Target Layer | Notes |
|---------|-----------------|----------|-------------------|------|-------------|-------|
| **typescript** | `^5.4.5` (dev) | `^5.4.5` (dev) | `^6.0.3` (dev) | 🔴 | All layers | Non-overlapping semver: `[5.4.5,6.0)` vs `[6.0.3,7.0)`. Must align to `^5.7.0`. |
| **uuid** | `^14.0.0` (dep) | `^14.0.0` (dep) | — | 🟢 | All layers | Exact match. Workspace hoists to single copy. |
| **graphology** | `^0.26.0` (dep) | `^0.26.0` (dep) | — | 🟢 | Business Logic | Core graph data structure used in pipeline + shared types. |
| **graphology-indices** | `^0.17.0` (dep) | `^0.17.0` (dep) | — | 🟢 | Business Logic | Index structures for communities, processes. |
| **graphology-utils** | `^2.3.0` (dep) | `^2.3.0` (dep) | — | 🟢 | All layers | Shared utility functions across all layers. |
| **lru-cache** | `^11.0.0` (dep) | `^11.2.4` (dep) | — | 🟢 | Business Logic | Both `^11.x`. Workspace hoists to latest satisfying 11.x. |
| **mnemonist** | `^0.40.3` (dep) | `^0.39.0` (dep) | — | 🟡 | Business Logic | Non-overlapping sub-1.0 ranges. Align UI to `^0.40.3`. |
| **pandemonium** | `^2.4.0` (dep) | `^2.4.0` (dep) | — | 🟢 | Business Logic | Exact match. Random/utility functions. |
| **vitest** | `^4.0.18` (dev) | `^4.1.5` (dev) | — | 🟢 | All layers (dev) | Both `^4.x`. Compatible but drifting; align to single version. |
| **@vitest/coverage-v8** | `^4.0.18` (dev) | `^4.1.5` (dev) | — | 🟢 | All layers (dev) | Both `^4.x`. Align with vitest version. |
| **@types/node** | `^25.6.0` (dev) | `^25.6.0` (dev) | — | 🟢 | All layers (dev) | Exact match. Pure types, no runtime impact. |
| **gitnexus-shared** | `file:./shared` (dev) | `file:../shared` (dep) | — | 🟢 | All layers | Internal workspace link. Types + utilities only. |

### Risk definitions
- 🟢 **Green** — Compatible ranges; workspace hoists to one satisfying version.
- 🟡 **Yellow** — Ranges do not overlap; npm installs multiple copies; API drift possible.
- 🔴 **Red** — Incompatible major versions; breaks workspace hoisting; requires manual resolution.

---

## Section B: Presentation Layer Dependencies

The Presentation Layer includes three adapters: CLI, MCP Server, and Web UI. Each has distinct dependency concerns. **No business logic libraries should appear here.**

### B.1 CLI-Specific (`src/cli/`)

| Package | Version (Root) | Purpose | Platform | Architecture Status |
|---------|---------------|---------|----------|-------------------|
| `commander` | ^14.0.3 | CLI argument parsing | Node.js | ✅ Correct — Presentation layer |
| `cli-progress` | ^3.12.0 | Terminal progress bars | Node.js | ✅ Correct — Presentation layer |
| `pino` | ^10.3.1 | Structured logging | Node.js | ✅ Correct — Infrastructure (cross-cutting) |
| `pino-pretty` | ^13.1.3 | Pretty-print logs | Node.js | ✅ Correct — Presentation layer |
| `tsx` | ^4.0.0 | TS execution (dev) | Node.js | ✅ Correct — dev tooling |

### B.2 MCP-Specific (`src/mcp/`)

| Package | Version (Root) | Purpose | Platform | Architecture Status |
|---------|---------------|---------|----------|-------------------|
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP protocol server | Node.js | ✅ Correct — Presentation layer (protocol) |

Note: The MCP helper files (`helpers/search.ts`, `context-tools.ts`, etc.) currently import Business Logic directly — see `02-MCP-Adapter.md` for the violation details. The `@modelcontextprotocol/sdk` itself is a pure protocol library, NOT business logic.

### B.3 Express HTTP Server (`src/server/`)

| Package | Version (Root) | Purpose | Platform | Architecture Status |
|---------|---------------|---------|----------|-------------------|
| `express` | ^4.19.2 | HTTP framework | Node.js | ✅ Correct — Presentation layer |
| `cors` | ^2.8.5 | CORS middleware | Node.js | ✅ Correct — Presentation layer |
| `express-rate-limit` | ^8.4.1 | Rate limiting | Node.js | ✅ Correct — Presentation layer |

### B.4 Web UI-Specific (`ui/`)

| Package | Version (UI) | Purpose | Platform | Architecture Status | Notes |
|---------|-------------|---------|----------|-------------------|-------|
| `react` | ^19.2.5 | UI framework | Browser | ✅ Keep — Presentation | Core rendering |
| `react-dom` | ^19.2.6 | DOM renderer | Browser | ✅ Keep — Presentation | |
| `sigma` | ^3.0.2 | Graph visualization | Browser | ✅ Keep — Presentation | WebGL rendering |
| `@sigma/edge-curve` | ^3.1.0 | Edge curves | Browser | ✅ Keep — Presentation | |
| `d3` | ^7.9.0 | Data visualization | Browser | ✅ Keep — Presentation | Charts/stats |
| `mermaid` | ^11.14.0 | Diagram rendering | Browser | ✅ Keep — Presentation | |
| `lucide-react` | ^1.14.0 | Icons | Browser | ✅ Keep — Presentation | |
| `tailwindcss` | ^4.2.4 | CSS framework | Build | ✅ Keep — Presentation | |
| `@tailwindcss/vite` | ^4.2.4 | Vite plugin | Build | ✅ Keep — Presentation | |
| `vite` | ^8.0.10 | Build tool | Build | ✅ Keep — Presentation | |
| `@vitejs/plugin-react` | ^5.1.4 | React plugin | Build | ✅ Keep — Presentation | |
| `axios` | ^1.16.0 | HTTP client | Browser/Node | ✅ Keep — Presentation | API calls to backend |
| `zod` | ^3.25.76 | Schema validation | Browser/Node | ✅ Keep — Presentation | |
| `react-markdown` | ^10.1.0 | Markdown rendering | Browser | ✅ Keep — Presentation | |
| `remark-gfm` | ^4.0.1 | GFM Markdown | Browser | ✅ Keep — Presentation | |
| `react-syntax-highlighter` | ^16.1.0 | Syntax highlighting | Browser | ✅ Keep — Presentation | |
| `react-zoom-pan-pinch` | ^4.0.3 | Zoom/pan | Browser | ✅ Keep — Presentation | |
| `dompurify` | ^3.4.2 | HTML sanitization | Browser | ✅ Keep — Presentation | XSS prevention |

### B.5 Packages to REMOVE from UI (Target: Business Logic Layer)

| Current Package | Current Verson | Reason for Removal | Target Location | Priority |
|-----------------|---------------|-------------------|-----------------|----------|
| `@langchain/anthropic` | ^1.3.29 | LLM provider for Graph RAG agent | Root `dependencies` | 🔴 P0 |
| `@langchain/core` | ^1.1.44 | LangChain primitives | Root `dependencies` | 🔴 P0 |
| `@langchain/google-genai` | ^2.1.28 | Gemini provider | Root `dependencies` | 🔴 P0 |
| `@langchain/langgraph` | ^1.2.9 | Agentic state machine | Root `dependencies` | 🔴 P0 |
| `@langchain/ollama` | ^1.2.6 | Ollama provider | Root `dependencies` | 🔴 P0 |
| `@langchain/openai` | ^1.4.5 | OpenAI provider | Root `dependencies` | 🔴 P0 |
| `langchain` | ^1.3.5 | LangChain orchestration | Root `dependencies` | 🔴 P0 |
| `graphology-layout-force` | ^0.2.4 | Force-directed layout | Root `dependencies` | 🟡 P1 |
| `graphology-layout-forceatlas2` | ^0.10.1 | ForceAtlas2 layout | Root `dependencies` | 🟡 P1 |
| `graphology-layout-noverlap` | ^0.4.2 | No-overlap layout | Root `dependencies` | 🟡 P1 |

### B.6 Packages to RECATEGORIZE in UI

| Current Package | Current Location | Correct Location | Reason | Priority |
|-----------------|-----------------|------------------|--------|----------|
| `@rolldown/binding-win32-x64-msvc` | `dependencies` | `devDependencies` | Build-only bundler binding; platform-locked | 🟡 P1 |
| `tree-sitter-wasms` | `devDependencies` | **Remove** | Dead dependency — zero imports in any `.ts`/`.tsx` file | 🟢 P2 |

---

## Section C: Business Logic Layer Dependencies (Root Core — Unified System)

These are the dependencies that power the pipeline, search, embeddings, and query systems. ALL business logic libraries belong here.

### C.1 Tree-Sitter Ecosystem

| Package | Version (Root) | Type | Pipeline Phase | Native Binding | CPU-Only | Swappability |
|---------|---------------|------|---------------|----------------|----------|-------------|
| `tree-sitter` | ^0.21.1 | Native C addon | INGESTION | node-gyp (C) | ✅ Yes | No — 17+ files import directly |
| `web-tree-sitter` | ^0.26.8 | WASM runtime | INGESTION | WASM (agnostic) | ✅ Yes | Yes — WASM fallback for portable build |
| `tree-sitter-c` | 0.21.4 | Grammar | INGESTION | Native C | ✅ Yes | Language parsers individually addable/removable |
| `tree-sitter-c-sharp` | 0.23.1 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-cpp` | 0.23.2 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-go` | ^0.23.0 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-java` | ^0.23.5 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-javascript` | ^0.23.0 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-php` | ^0.23.0 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-python` | 0.23.4 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-ruby` | ^0.23.1 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-rust` | 0.23.1 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-typescript` | ^0.23.2 | Grammar | INGESTION | Native C | ✅ Yes | |
| `tree-sitter-dart` (vendored) | `file:` | Grammar | INGESTION | Native C | ✅ Yes | Optional — vendored |
| `tree-sitter-kotlin` | ^0.3.8 | Grammar | INGESTION | Native C | ✅ Yes | Optional — npm |
| `tree-sitter-proto` (vendored) | `file:` | Grammar | INGESTION | Native C | ✅ Yes | Optional — vendored |
| `tree-sitter-swift` (vendored) | `file:` | Grammar | INGESTION | Native C | ✅ Yes | Optional — vendored |

**Install notes:** Native tree-sitter requires `python3`, `make`, `g++` (node-gyp). Postinstall scripts build `tree-sitter-dart` and `tree-sitter-proto` via `scripts/build-tree-sitter-dart.cjs` and `scripts/build-tree-sitter-proto.cjs`.

### C.2 LadybugDB (Data / Storage — shared with Data Layer)

| Package | Version (Root) | Type | Pipeline Phases | Platform | CPU-Only | Swappability |
|---------|---------------|------|----------------|----------|----------|-------------|
| `@ladybugdb/core` | ^0.16.1 | Pure JS (embedded DB) | LADYBUGDB, SEARCH, EMBEDDINGS | Node.js (any) | ✅ Yes | **No** — 14+ adapter functions hard-coded across 3 stages |

### C.3 Embedding Ecosystem

| Package | Version (Root) | Type | Pipeline Phase | Platform | CPU-Only | Swappability |
|---------|---------------|------|---------------|----------|----------|-------------|
| `onnxruntime-node` | ^1.24.0 | **Native** ML inference | EMBEDDINGS | Node.js (prebuilt: win32-x64, darwin-x64/arm64, linux-x64/arm64) | ✅ CPU (AVX) | Partial — `EmbeddingProvider` interface exists |
| `@huggingface/transformers` | ^4.1.0 | Model loading | EMBEDDINGS | Node.js (depends on onnxruntime-node) | ✅ Yes | No — model path hard-coded to e5-small |

**Overrides block** (`gitnexus/package.json:117-119`):
```json
"@huggingface/transformers": {
  "onnxruntime-node": "$onnxruntime-node"
}
```
This pins the `onnxruntime-node` version across `@huggingface/transformers` to match the repo's `^1.24.0`.

### C.4 New Arrivals from UI (Proposed Migration)

These packages currently live in `ui/package.json` but will be **moved to Root dependencies** as part of architectural cleanup:

| Package | Current Version (UI) | Proposed Version (Root) | Purpose | Pipeline Phase | 
|---------|---------------------|------------------------|---------|---------------|
| `@langchain/core` | ^1.1.44 | ^1.1.44 | LangChain primitives | Query (RAG Agent) |
| `@langchain/langgraph` | ^1.2.9 | ^1.2.9 | Agentic state machine | Query (RAG Agent) |
| `@langchain/openai` | ^1.4.5 | ^1.4.5 | OpenAI provider | Query (RAG Agent) |
| `@langchain/anthropic` | ^1.3.29 | ^1.3.29 | Anthropic provider | Query (RAG Agent) |
| `@langchain/google-genai` | ^2.1.28 | ^2.1.28 | Gemini provider | Query (RAG Agent) |
| `@langchain/ollama` | ^1.2.6 | ^1.2.6 | Ollama provider | Query (RAG Agent) |
| `langchain` | ^1.3.5 | ^1.3.5 | Orchestration | Query (RAG Agent) |
| `graphology-layout-force` | ^0.2.4 | ^0.2.4 | Force layout | Boost (Post-Pipeline) |
| `graphology-layout-forceatlas2` | ^0.10.1 | ^0.10.1 | ForceAtlas2 layout | Boost (Post-Pipeline) |
| `graphology-layout-noverlap` | ^0.4.2 | ^0.4.2 | No-overlap layout | Boost (Post-Pipeline) |

**Total added install size:** ~15+ MB (LangChain family is heavy). This eliminates duplication since the agent moves server-side.

### C.5 Server / API Dependencies (Cross-Cutting Infrastructure)

| Package | Version (Root) | Purpose | Platform | CPU-Only |
|---------|---------------|---------|----------|----------|
| `express` | ^4.19.2 | HTTP framework | Node.js | ✅ Yes |
| `cors` | ^2.8.5 | CORS middleware | Node.js | ✅ Yes |
| `express-rate-limit` | ^8.4.1 | Rate limiting | Node.js | ✅ Yes |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP protocol | Node.js | ✅ Yes |

### C.6 Pipeline Infrastructure Dependencies

| Package | Version (Root) | Purpose | Pipeline Phase | Platform |
|---------|---------------|---------|---------------|----------|
| `glob` | ^13.0.6 | File globbing | INGESTION (scan phase) | Node.js |
| `ignore` | ^7.0.5 | .gitignore patterns | INGESTION (scan phase) | Node.js |
| `js-yaml` | ^4.1.1 | YAML parsing | INGESTION (config) | Node.js |
| `jsonc-parser` | ^3.3.1 | JSONC parsing | INGESTION (config) | Node.js |
| `graphology` | ^0.26.0 | Graph data structure | INGESTION + Post-Pipeline | Node.js |
| `graphology-indices` | ^0.17.0 | Index structures | INGESTION (communities) | Node.js |
| `graphology-utils` | ^2.3.0 | Graph utilities | All phases | Node.js |
| `lru-cache` | ^11.0.0 | Caching | Infrastructure | Node.js |
| `mnemonist` | ^0.40.3 | Data structures | INGESTION + Search | Node.js |
| `pandemonium` | ^2.4.0 | Random/utilities | INGESTION | Node.js |
| `uuid` | ^14.0.0 | UUID generation | Infrastructure | Node.js |

---

## Section D: Data / Storage Layer Dependencies

The Data Layer is minimal — it is dominated by LadybugDB as the sole concrete database. Most "data layer" code lives within `src/core/lbug/lbug-adapter/` (14+ adapter functions) and `src/storage/` (repo-manager).

| Dependency | Version | Type | Purpose | Location |
|-----------|---------|------|---------|----------|
| `@ladybugdb/core` | ^0.16.1 | Pure JS (embedded) | Graph store, FTS indexes, vector index | `src/core/lbug/lbug-adapter/` (shared with Business Logic) |
| Node.js `fs` | Built-in | Native | File I/O for meta.json, registry | `src/storage/repo-manager.ts`, `src/core/analyze/finalizer.ts` |
| Node.js `path` | Built-in | Native | Path resolution | Across all layers |
| Node.js `crypto` | Built-in | Native | Content hashing | `src/core/embeddings/` |
| `~/.gitnexus/registry.json` | — | JSON file | Cross-repo registry | User home directory |
| `~/.cache/huggingface/hub/` | — | ONNX model cache | e5-small model (~690MB) | HuggingFace cache directory |

### LadybugDB Tight Coupling (Critical Risk)

`@ladybugdb/core` is shared between Business Logic and Data/Storage layers. Currently:
- Business Logic owns the DB lifecycle (init, close, load, query) via `src/core/lbug/lbug-adapter/`
- All 5 pipeline stages import LadybugDB functions directly
- 14+ adapter functions would need abstraction behind a `GraphDatabaseProvider` interface

**Risk level:** HIGH — replacing LadybugDB with any alternative (SQLite, DuckDB, Neo4j) requires refactoring across 3 pipeline stages and 14+ adapter functions.

---

## Section E: Dependency Migration Plan

### E.1 Package Moves (What Moves Where)

| # | Package | From | To | Target Layer | Reason | Priority | Status |
|---|---------|------|----|-------------|--------|----------|--------|
| 1 | `@langchain/core` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns LLM orchestration; agent moves server-side | 🔴 P0 | Proposed |
| 2 | `@langchain/anthropic` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns LLM orchestration | 🔴 P0 | Proposed |
| 3 | `@langchain/google-genai` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns LLM orchestration | 🔴 P0 | Proposed |
| 4 | `@langchain/langgraph` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns agentic state machine | 🔴 P0 | Proposed |
| 5 | `@langchain/ollama` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns LLM orchestration | 🔴 P0 | Proposed |
| 6 | `@langchain/openai` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns LLM orchestration | 🔴 P0 | Proposed |
| 7 | `langchain` | `ui/dependencies` | `root/dependencies` | Business Logic | BL owns LangChain orchestration | 🔴 P0 | Proposed |
| 8 | `graphology-layout-force` | `ui/dependencies` | `root/dependencies` | Business Logic | Server-side layout calc (Post-Pipeline) | 🟡 P1 | Proposed |
| 9 | `graphology-layout-forceatlas2` | `ui/dependencies` | `root/dependencies` | Business Logic | Server-side layout calc | 🟡 P1 | Proposed |
| 10 | `graphology-layout-noverlap` | `ui/dependencies` | `root/dependencies` | Business Logic | Server-side layout calc | 🟡 P1 | Proposed |

### E.2 Version Alignments

| # | Package | Current (Source) | Current (Target) | Proposed | Priority |
|---|---------|-----------------|-----------------|----------|----------|
| 11 | `typescript` | Shared: `^6.0.3` | Root/UI: `^5.4.5` | All: `^5.7.0` | 🔴 P0 |
| 12 | `mnemonist` | UI: `^0.39.0` | Root: `^0.40.3` | UI: `^0.40.3` | 🟡 P1 |
| 13 | `vitest` | UI: `^4.1.5` | Root: `^4.0.18` | All: `^4.0.18` | 🟢 P2 |
| 14 | `@vitest/coverage-v8` | UI: `^4.1.5` | Root: `^4.0.18` | All: `^4.0.18` | 🟢 P2 |

### E.3 Category Corrections

| # | Package | File | Current | Correct | Reason | Priority |
|---|---------|------|---------|---------|--------|----------|
| 15 | `@rolldown/binding-win32-x64-msvc` | `ui/package.json:27` | `dependencies` | `devDependencies` | Build-only bundler binding; platform-locked | 🟡 P1 |
| 16 | `tree-sitter-wasms` | `ui/package.json:72` | `devDependencies` | **Remove** | Dead dependency — zero imports | 🟢 P2 |

### E.4 Architecture Cleanup (Code Moves)

| # | What | Current Location | Target Location | Layer | Priority |
|---|------|-----------------|-----------------|-------|----------|
| 17 | Graph RAG Agent (6 files) | `ui/src/core/llm/` | `src/core/llm/` | Business Logic | 🔴 P0 |
| 18 | Cluster Enricher | `ui/src/core/ingestion/cluster-enricher.ts` | `src/core/boost/cluster-enricher.ts` | Business Logic | 🟡 P1 |
| 19 | Graph Layout calculator | Inlined in UI via `graphology-layout-*` | `src/core/post-pipeline/graph-layout.ts` | Business Logic | 🟡 P1 |
| 20 | MCP helper functions (10 files) | `src/mcp/local/helpers/*.ts` | `src/core/query-pipeline/` | Business Logic | 🟡 P1 |
| 21 | Search route composition | `src/server/routes/search.ts:34-150` | `src/core/query-pipeline/search.ts` | Business Logic | 🟡 P1 |

---

## Section F: Dependency Cleanup Impact

For each migration: what breaks, what needs testing, risk level.

### F.1 🔴 P0 — LangChain Migration (Items 1–7, 17)

| Aspect | Detail |
|--------|--------|
| **What breaks** | UI will lose in-browser Graph RAG agent functionality until server-side agent is operational. UI build will fail if `@langchain/*` imports still exist in `ui/src/core/llm/` after packages are removed. |
| **What needs testing** | All 7 tool implementations (`search`, `cypher`, `grep`, `read`, `overview`, `explore`, `impact`) must be verified to work with direct LadybugDB calls instead of HTTP backend calls. Multi-provider creation (OpenAI, Anthropic, Gemini, Ollama) must be tested. Streaming response (`streamAgentResponse`) must preserve deduplication logic. |
| **Risk level** | HIGH — 574-line agent file with 8 provider configs. Tool behavior changes from HTTP to direct DB. Regression in agent response quality if tools behave differently. |
| **Mitigation** | Keep `@langchain/*` in both `ui/` and `root/` during transition period. Migrate agent file by file, testing each tool. Feature-flag the server-side agent behind `--agent` flag during migration. |

### F.2 🟡 P1 — Graph Layout Migration (Items 8–10, 19)

| Aspect | Detail |
|--------|--------|
| **What breaks** | UI currently calculates layouts on every page load. Moving layout to server-side means the UI needs a fallback if cached layout is unavailable. |
| **What needs testing** | Layout results must be deterministic with fixed seed. Cache invalidation when graph topology changes. Fallback behavior (browser-side recalc) when cache is missing. |
| **Risk level** | MEDIUM — Layout is deterministic computation with well-understood algorithms. Main risk is cache coherence. |
| **Mitigation** | UI can fall back to browser-side `graphology-layout-*` if `meta.json#layout` is absent. Keep `graphology-layout-*` in UI `dependencies` during transition as optional fallback. |

### F.3 🔴 P0 — TypeScript Version Alignment (Item 11)

| Aspect | Detail |
|--------|--------|
| **What breaks** | Shared's `tsc` build will downgrade from TS 6 to TS 5. If Shared uses TS 6-only features (`using` declarations, `const` type parameters, `isolatedDeclarations`), the build breaks. |
| **What needs testing** | `cd shared && npx tsc --noEmit` with TS 5.7.x. Verify emitted `.d.ts` files are valid for Root/UI TS 5 consumers. Run `npm test` across all 3 packages. |
| **Risk level** | HIGH — TypeScript is a compile-to-JavaScript compiler. Major version downgrade could expose TS 6-only patterns. |
| **Mitigation** | First audit Shared source for TS 6-only features (grep for `using`, `await using`, `const` type parameters). If found, refactor before downgrading. Alternative: upgrade Root/UI to TS 6 instead. |

### F.4 🟡 P1 — Rolldown Binding Recategorization (Item 15)

| Aspect | Detail |
|--------|--------|
| **What breaks** | UI `npm run build` on Windows may fail if `@rolldown/binding-win32-x64-msvc` is not resolved transitively through `vite`'s dependency tree. Mac/Linux builds remain broken (they need their own bindings). |
| **What needs testing** | `cd ui && npm run build` on Windows, Mac, Linux without explicit binding. |
| **Risk level** | LOW — rolldown is used transitively by Vite. Most projects don't declare platform bindings directly. The explicit declaration was likely a workaround for a specific build issue. |

### F.5 🟡 P1 — mnemonist Version Alignment (Item 12)

| Aspect | Detail |
|--------|--------|
| **What breaks** | UI code using mnemonist APIs removed between 0.39 and 0.40. |
| **What needs testing** | `cd ui && npx tsc --noEmit` after upgrading. Run UI tests. Check for deprecation warnings. |
| **Risk level** | LOW — mnemonist 0.39 → 0.40 is mostly additive (new data structures). Grep for imports in UI: `Trie`, `FuzzyMap`, `MultiMap`, `InvertedIndex`. |

### F.6 🟢 P2 — tree-sitter-wasms Removal (Item 16)

| Aspect | Detail |
|--------|--------|
| **What breaks** | Nothing — zero imports confirmed via grep across all `.ts`, `.tsx`, `.js`, `.mjs` files in `ui/src/`. |
| **What needs testing** | `cd ui && npx tsc --noEmit` after removal. Verify no compilation errors. |
| **Risk level** | NONE — confirmed dead dependency. Saves ~5 MB in install size. |

---

## Section G: Dependency Layer Summary

```
PRESENTATION LAYER (~50 packages)
├── CLI:          commander, cli-progress, pino, pino-pretty
├── MCP:          @modelcontextprotocol/sdk
├── Server:       express, cors, express-rate-limit
└── Web UI:       react, react-dom, sigma, d3, mermaid, vite, tailwindcss,
                  axios, lucide-react, react-markdown, zod, etc.

                  ║ (HTTP for Web UI, direct call for CLI, MCP for AI agents)
                  ▼

BUSINESS LOGIC LAYER (~45 packages)
├── Tree-sitter:  tree-sitter (native) + web-tree-sitter (WASM) + 12+ grammars
├── Pipeline:     graphology, graphology-indices, lru-cache, mnemonist
├── Embeddings:   onnxruntime-node (CPU), @huggingface/transformers
├── Server/API:   express, cors, rate-limit, @modelcontextprotocol/sdk
├── [NEW from UI]: @langchain/*, langchain, graphology-layout-*
└── Config:       js-yaml, jsonc-parser, glob, ignore

                  ║ (direct function calls through adapters)
                  ▼

DATA / STORAGE LAYER (~2 direct deps)
├── @ladybugdb/core  (embedded, tightly coupled — shared with Business Logic)
├── Node.js built-in: fs, path, crypto
└── Files:           meta.json, registry.json, ONNX model cache
```
