# Pipeline Architecture & Flow Map — GitNexus

> **Analytical/Descriptive** — maps all pipelines, logic flow, and data flow across the architecture.
> Generated 2026-05-14 from `src/core/pipeline-contract/`, `src/core/ingestion/pipeline.ts`,
> `src/core/embeddings/embedding-pipeline.ts`, `src/core/run-analyze.ts`

---

## 1. Three Pipeline Systems (Nested Hierarchy)

| System | Abstraction | Phases | Runner | Location |
|--------|------------|--------|--------|----------|
| **PipelineContract** (orchestrator) | 5 high-level stages | INGESTION → LADYBUGDB → SEARCH → EMBEDDINGS → FINALIZE | `runner.ts` DFS topological sort | `src/core/pipeline-contract/` |
| **Ingestion Pipeline** (low-level) | 14-phase DAG | scan → structure → [markdown/cobol] → parse → [routes/tools/orm] → crossFile → scopeResolution → [mro/communities/processes] | Kahn's algorithm | `src/core/ingestion/pipeline-phases/runner.ts` |
| **Embeddings Pipeline** (low-level) | 5 sub-phases | Load model → Query nodes → Chunk+embed → Vector index → Ready | Sequential in `embedding-pipeline.ts` | `src/core/embeddings/` |

---

## 2. PipelineContract — 5-Stage Dependency DAG

```
Depth 0:     INGESTION ← no deps
                  │
Depth 1:     LADYBUGDB ← dep: INGESTION (needs graph)
                  │
          ┌───────┴───────┐
Depth 2:   │               │
          SEARCH         EMBEDDINGS
        dep: LB          dep: LB
          │               │
          └───────┬───────┘
                  │
Depth 3:     FINALIZE ← dep: INGESTION + LB + SEARCH + EMBEDDINGS
```

**Topological order (resolved by DFS in `runner.ts:resolvePipelines`):**

| Order | Stage | Depth | Registration |
|-------|-------|-------|-------------|
| 1 | INGESTION | 0 | `createIngestionStage()` |
| 2 | LADYBUGDB | 1 | `createLadybugStage()` |
| 3 | SEARCH | 2 | `createSearchStage()` |
| 4 | EMBEDDINGS | 2 | `createEmbeddingStage()` |
| 5 | FINALIZE | 3 | `createFinalizeStage()` |

Stages at same depth run in **registration order** (no parallelism in current runner).

---

## 3. Logic Flow — PipelineRunner Orchestration

```
runFullAnalysis(repoPath, options, callbacks)
  │
  ├── 0. PRELUDE (unchanged from original)
  │   ├── getStoragePaths → { storagePath, lbugPath }
  │   ├── cleanupOldKuzuFiles() — KuzuDB → LadybugDB migration
  │   ├── getCurrentCommit() + loadMeta()
  │   └── Early return: if up-to-date && no --embeddings → return { alreadyUpToDate }
  │
  ├── 1. BUILD PipelineContext
  │   { repoPath, storagePath, lbugPath, options, callbacks,
  │     results: Map(), tempDir, log(), progress() }
  │
  ├── 2. REGISTER 5 contracts → Map<PipelineId, PipelineContract>
  │
  ├── 3. DETERMINE skip set
  │   ├── Full rebuild: skip = {}
  │   └── Embeddings-only: skip = { INGESTION, LADYBUGDB, SEARCH }
  │
  ├── 4. initLbug(lbugPath) — open DB (needed in skip mode)
  │
  └── 5. RUN runner.runPipelines(ctx, { force, skip, failFast })
        │
        ├── resolveOrder()
        │   └── DFS topological sort → [[INGESTION], [LADYBUGDB],
        │        [SEARCH, EMBEDDINGS], [FINALIZE]]
        │
        └── FOR each depth-group:
            └── FOR each pipeline in group:
                 │
                 ├── RESOURCE CHECK
                 │   └── Fatal resource unavailable → FAILED (failFast abort)
                 │
                 ├── FRESHNESS CHECK (unless --force)
                 │   ├── Load stored artifact from meta.json#artifacts
                 │   └── Compute current fingerprint
                 │       └── Match → FRESH, skip execution
                 │
                 ├── EXPLICIT SKIP check
                 │   └── In skipSet → SKIPPED (no error)
                 │
                 ├── onBeforeInvalidation hook
                 │   ├── Run own hook (e.g., EMBEDDINGS → loadEmbeddingCache)
                 │   └── notifyDependents() → all downstream stages
                 │
                 ├── contract.run(ctx) — execute stage
                 │   └── On throw → FAILED (failFast abort)
                 │
                 ├── SAVE artifact fingerprint to meta.json
                 │
                 └── Store output in report.results
```

**PipelineRunReport** structure:
```
{
  results: Map<PipelineId, { output: unknown, artifact?: ArtifactRecord, durationMs: number }>
  skipped: PipelineId[]   — explicitly skipped
  failed:  PipelineId[]   — threw or resource-unavailable
  fresh:   PipelineId[]   — fingerprint matched, not run
}
```

---

## 4. Data Flow — Index Write Path

```
User: npx gitnexus analyze --embeddings
  │
  ▼
cli/index.ts ──► cli/analyze.ts (heap check, SIGINT, progress bar)
  │
  ▼
src/core/run-analyze.ts :: runFullAnalysis()
  │
  ├── PipelineContext { repoPath, storagePath, lbugPath, options, callbacks }
  ├── PipelineRunner(5 contracts)
  │
  ├── STAGE: INGESTION
  │   └── runPipelineFromRepo(repoPath, progress)
  │       └── 14-phase DAG → in-memory KnowledgeGraph
  │           { graph, repoPath, totalFileCount, communityResult }
  │
  ├── STAGE: LADYBUGDB
  │   ├── closeLbug() + rm .lbug/.wal/.lock
  │   ├── initLbug(lbugPath)
  │   └── loadGraphToLbug(graph, repoPath, storagePath, onMsg)
  │       └──  DISK: .gitnexus/{name}/lbug.lb
  │
  ├── STAGE: SEARCH
  │   ├── createSearchFTSIndexes()
  │   │   └──  DISK: FTS indexes inside lbug.lb
  │   └── restoreCachedEmbeddings(cache, ...) — from _stageCache
  │       └──  DISK: batch insert into lbug.lb
  │
  ├── STAGE: EMBEDDINGS
  │   ├── onBeforeInvalidation → loadEmbeddingCache() → _stageCache
  │   ├── deriveEmbeddingMode() + deriveEmbeddingCap()
  │   ├── logPerLabelNodeCounts()
  │   └── runEmbeddingPipeline(executeQuery, executeWithReusedStmt, ...)
  │       ├── initEmbedder() ← ONNX model OR HTTP endpoint
  │       ├── queryEmbeddableNodes()
  │       ├── chunk → embed → batchInsertEmbeddings()
  │       │   └──  DISK: vector rows in lbug.lb
  │       └── createVectorIndex()
  │           └──  DISK: vector index in lbug.lb
  │
  └── STAGE: FINALIZE
      ├── countEmbeddings()
      ├── buildMeta(input, embeddingCount)
      │   ├── saveMeta(storagePath, meta)
      │   │   └──  DISK: .gitnexus/{name}/meta.json
      │   │           { lastCommit, indexedAt, stats, capabilities, artifacts }
      │   ├── registerRepo()
      │   │   └──  DISK: ~/.gitnexus/registry.json
      │   └── generateAIContextFiles()
      │           AGENTS.md, CLAUDE.md
      ├── closeLbug()
      └── return AnalyzeResult
```

### Files Written to Disk

| File Path | Stage | Schema |
|-----------|-------|--------|
| `.gitnexus/{name}/lbug.lb` | LADYBUGDB | LadybugDB binary (graph + FTS + vectors + indexes) |
| `.gitnexus/{name}/lbug.lb.wal` | LADYBUGDB | Write-ahead log |
| `.gitnexus/{name}/meta.json` | FINALIZE | `{ lastCommit, indexedAt, stats, capabilities, artifacts, semanticMode }` |
| `~/.gitnexus/registry.json` | FINALIZE | `{ [name]: { repoPath, indexedAt, lastCommit } }` |
| `AGENTS.md` / `CLAUDE.md` | FINALIZE | AI context files (best-effort) |

---

## 5. Data Flow — Query Read Path

```
MCP Client (Claude Desktop)              HTTP Client (curl, web UI)
  │                                           │
  │ MCP stdio protocol                        │ HTTP GET/POST :4747/api/*
  ▼                                           ▼
mcp/server.ts                            server/routes/
(protocol handler,                       query.ts / search.ts /
 tool registry,                          graph.ts / processes.ts /
 tool dispatch)                          symbols.ts
  │                                           │
  └───────────┬───────────────────────────────┘
              │
              ▼
    mcp/local/local-backend.ts
    (LocalBackend.callTool() dispatch)
              │
      ┌───────┼───────┬──────────────────┐
      ▼       ▼       ▼                  ▼
  impact.ts  symbol  group.ts        bm25-index.ts
  (query)    context  (cross-repo)    (FTS search)
      │       │       │                  │
      └───────┴───────┴──────────────────┘
              │
              ▼
    core/lbug/lbug-adapter/
    ┌─────────────────────┐
    │ executeQuery(cypher)│ → conn.query() → rows → JSON
    │ streamQuery(cypher) │ → row-by-row callback
    │ executePrepared     │ → parameterized
    │ executeWithReused   │ → batch writes
    └─────────────────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
  FTS search      Vector search
  (BM25)          (semantic / exact-scan)
      │               │
      └───────┬───────┘
              ▼
      hybridSearch()
      (BM25 reranked with vector)
              │
              ▼
          Result rows
```

### LadybugDB Query Functions

| Function | Location | Signature | Use |
|----------|----------|-----------|-----|
| `executeQuery` | `adapter/query.ts` | `(cypher) → rows[]` | Read, all rows at once |
| `streamQuery` | `adapter/query.ts` | `(cypher, onRow) → count` | Large results, row-by-row |
| `executePrepared` | `adapter/query.ts` | `(cypher, params) → rows[]` | Parameterized reads |
| `executeWithReusedStatement` | `adapter/query.ts` | `(cypher, params[]) → void` | Batch writes (reuses stmt) |
| `searchFTSFromLbug` | `core/search/bm25-index.ts` | `(query) → ranked[]` | BM25 FTS search |
| `hybridSearch` | `core/search/hybrid-search.ts` | `(query) → reranked[]` | Vector+BM25 fusion |
| `semanticSearch` | `core/embeddings/embedding-pipeline.ts` | `(query) → top-K` | Vector index search |

---

## 6. Cross-Stage Embedding Cache Flow

### Shared module state pattern (`_stageCache` in `embedding-stage.ts`)

This is the only cross-stage data flow that bypasses the PipelineContext results map.

```
Pre-rebuild (onBeforeInvalidation triggered when LADYBUGDB is stale)
  │
  ├── EMBEDDINGS.onBeforeInvalidation()
  │   ├── initLbug(oldLbugPath) — open existing DB
  │   ├── loadCachedEmbeddings() — read existing vectors
  │   │   └── SELECT nodeId, contentHash, embedding, dimensions FROM CodeEmbedding
  │   └── _stageCache = { cachedEmbeddings[], cachedEmbeddingNodeIds: Set }
  │
  ▼
LADYBUGDB.run() — destroys old .lbug, rebuilds fresh
  │
  ▼
SEARCH.run() — restore phase
  │
  ├── getStageCache() → reads _stageCache
  ├── if cache.cachedEmbeddings.length > 0:
  │   └── restoreCachedEmbeddings(cache, executeWithReusedStmt, log, progress)
  │       ├── batchInsertEmbeddings() — writes vectors back into NEW DB
  │       └── cache = restored cache (updated refs)
  │
  ▼
EMBEDDINGS.run() — incremental mode
  │
  ├── _stageCache.cachedEmbeddingNodeIds → skipNodeIds (don't re-embed)
  ├── _stageCache.cachedEmbeddings → existingEmbeddings (Map<nodeId, contentHash>)
  │   └── Compare content hashes → DELETE stale, skip unchanged
  └── runEmbeddingPipeline(..., skipNodeIds, existingEmbeddings)
```

**Key insight:** The cache survives LadybugDB destruction by being in memory (`_stageCache`), then gets restored into the new DB by the SEARCH stage, and finally consumed by the EMBEDDINGS stage for incremental embedding.

---

## 7. Progress Flow (PipelineContext.progress)

```
callbacks.onProgress(phase, percent, message)
  ▲
  │ ┌─ PipelineContext.progress() ──────────────────────────────┐
  │ │                                                           │
  │ ├── INGESTION  [0-60%]  14-phase progress × 0.6            │
  │ │   scan=2%, structure=5%, parse=20%, ..., processes=60%   │
  │ │                                                           │
  │ ├── LADYBUGDB [60-84%]  loadGraphToLbug message count      │
  │ │   60 + min(24, count/(count+10)×24)                      │
  │ │                                                           │
  │ ├── SEARCH    [85-90%]  FTS creation + cache restore       │
  │ │   85='Creating search indexes...'                         │
  │ │   90='Search indexes ready'                               │
  │ │                                                           │
  │ ├── EMBEDDINGS [90-98%] sub-phases × 8% range              │
  │ │   90='Loading model...'                                   │
  │ │   90-98='Embedding N/M'                                   │
  │ │                                                           │
  │ └── FINALIZE  [98-100%] save metadata                      │
  │     98='Saving metadata...'                                 │
  │     100='Done'                                              │
  └─────────────────────────────────────────────────────────────┘
```

---

## 8. Embedding Mode Decision Tree

```
Input: --embeddings? --force? --drop-embeddings?
       + existing stas.embeddings count from meta.json

┌──────────────────────────────────────────────────────┐
│ dropEmbeddings?                                      │
├── YES → shouldLoadCache = false                      │
│         shouldGenerate = false                       │
│         forceRegenerate = false                      │
│         (explicit wipe — no generation, no cache)    │
│                                                      │
└── NO  → ┌── explicit --embeddings?                   │
          ├── YES → shouldLoadCache = true             │
          │         shouldGenerate = true              │
          │                                            │
          └── NO  → ┌── existing > 0?                  │
                    ├── YES → ┌── force?                │
                    │         ├── YES → shouldGenerate  │
                    │         │         (regenerate)     │
                    │         └── NO  → preserve only   │
                    │                  (load + restore, │
                    │                   no generation)   │
                    │                                   │
                    └── NO  → no cache, no generation   │
                              (first-time analyze)      │
└──────────────────────────────────────────────────────┘

Node cap: DEFAULT_EMBEDDING_NODE_LIMIT = 50,000
  --embeddings <n> → custom cap
  --embeddings 0   → no cap (force full generation)
```

---

## 9. Dual-Level Topological Sort Architecture

| Sort Level | Algorithm | Scope | Location | Cycle Detection |
|-----------|-----------|-------|----------|----------------|
| **PipelineContract** | DFS depth assignment | 5 stages | `runner.ts:resolvePipelines()` | visited + stack tracking |
| **Ingestion Phases** | Kahn's algorithm (queue-based) | 14 phases | `pipeline-phases/runner.ts` | remaining-node check |

Both produce valid execution orders independently. The **ingestion phase runner** also validates all declared deps exist in the phase registry (fail-fast on startup).

---

## 10. Artifact Freshness Chain

| Artifact | Depends On | Fingerprint Basis | Used By |
|----------|-----------|-------------------|---------|
| `ingestion` | git-commit | Git commit hash or directory mtime | INGESTION stage |
| `ladybugdb` | ingestion | Graph structure hash (node+label distribution) | LADYBUGDB stage |
| `embeddings` | ingestion, model-config | Graph fingerprint + content hashes of embeddable nodes | EMBEDDINGS stage |

**Note:** Currently the fingerprint `compute()` uses timestamp-based fallbacks. The dependency chain is designed for future use when actual structural hashing is implemented.

---

## 11. Resource Declaration Matrix

| Stage | Fatal Resources | Degrade Resources |
|-------|----------------|-------------------|
| INGESTION | wasm-runtime (web-tree-sitter), source-files | grammars (tree-sitter languages) |
| LADYBUGDB | ladybugdb-core (@ladybugdb/core), disk-space | — |
| SEARCH | ladybugdb-core | — |
| EMBEDDINGS | embedding-model (ONNX files), onnx-runtime, memory (RAM) | model-cap (50K node safety cap) |
| FINALIZE | filesystem (write access to .gitnexus/) | — |

---

## 12. Dual Embedding Backend Dispatch

```
PortabilityContract (selected at bootstrap)
  ├── hasOnnxRuntimeNode=true  → NativeNodeProvider (dev build, CPU)
  │                               onnxruntime-node with AVX support
  │
  └── hasHttpEmbeddings=true   → HTTP client (portable build, via web-tree-sitter)
                                  or remote embedding server
                                       ▲
                                       │
                              Selected in embedding-pipeline.ts
                              based on IS_PORTABLE_BUILD flag
```

Both paths implement `EmbeddingProvider` (`src/core/embeddings/provider.ts`) with `embedBatch()` and `dimensions()`.

---

## 13. Files Referenced

| Path | Role |
|------|------|
| `src/core/pipeline-contract/types.ts` | PipelineContract interface, PipelineRunner, PipelineContext |
| `src/core/pipeline-contract/runner.ts` | PipelineRuntime — topological sort, freshness, invalidation |
| `src/core/pipeline-contract/stages.ts` | Stage-specific output types (IngestionOutput, EmbeddingResult, etc.) |
| `src/core/pipeline-contract/descriptors.ts` | STAGE_IDS, STAGE_DEPENDENCIES, STAGE_RESOURCES, STAGE_ARTIFACTS |
| `src/core/pipeline-contract/impl/ingestion-stage.ts` | Concrete INGESTION stage |
| `src/core/pipeline-contract/impl/lbug-stage.ts` | Concrete LADYBUGDB stage |
| `src/core/pipeline-contract/impl/search-stage.ts` | Concrete SEARCH stage |
| `src/core/pipeline-contract/impl/embedding-stage.ts` | Concrete EMBEDDINGS stage (+ getStageCache) |
| `src/core/pipeline-contract/impl/finalize-stage.ts` | Concrete FINALIZE stage |
| `src/core/run-analyze.ts` | Orchestrator — builds runner, determines skip, invokes |
| `src/core/ingestion/pipeline.ts` | The original 14-phase ingestion DAG |
| `src/core/ingestion/pipeline-phases/runner.ts` | Kahn's algorithm sort for 14 phases |
| `src/core/embeddings/embedding-pipeline.ts` | Embedding sub-pipeline (model → chunk → embed → index) |
| `src/core/embedding-mode.ts` | Embedding mode decision function |
| `src/core/embeddings/provider.ts` | EmbeddingProvider interface + default concretions |
| `src/core/embeddings/cache-loader.ts` | loadEmbeddingCache + restoreCachedEmbeddings |
| `src/core/embeddings/diagnostic.ts` | logPerLabelNodeCounts |
| `src/core/lbug/lbug-adapter/` | LadybugDB query functions |
| `src/core/search/fts-indexes.ts` | createSearchFTSIndexes |
| `src/core/search/hybrid-search.ts` | hybridSearch (vector + BM25) |
| `src/core/portability/contract.ts` | PortabilityContract (Bun vs Node.js dispatch) |
| `src/core/analyze/finalizer.ts` | buildMeta, countEmbeddings, registerRepo |
| `src/storage/repo-manager.ts` | saveMeta, loadMeta, getStoragePaths |
