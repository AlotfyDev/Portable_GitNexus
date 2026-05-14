# Components-Level KG: CLI + Server Layers

## File Listing with Sizes

### CLI Layer (`src/cli/`) — 22 files, 183,003 total bytes

| File | Size | Role | Exports |
|------|------|------|---------|
| `index.ts` | 10,776 | **Entry** | None (CLI entry via commander) |
| `lazy-action.ts` | 847 | **Dispatch** | `createLazyAction` |
| `analyze.ts` | 26,202 | **Command** | `analyzeCommand` |
| `setup.ts` | 23,137 | **Command** | `setupCommand` |
| `wiki.ts` | 24,054 | **Command** | `wikiCommand` |
| `skill-gen.ts` | 23,649 | **Utility** | `generateSkillFiles`, `GeneratedSkillInfo` |
| `serve.ts` | 2,360 | **Command** | `serveCommand` |
| `mcp.ts` | 4,132 | **Command** | `mcpCommand` |
| `list.ts` | 1,726 | **Command** | `listCommand` |
| `status.ts` | 1,441 | **Command** | `statusCommand` |
| `doctor.ts` | 1,662 | **Command** | `doctorCommand` |
| `clean.ts` | 2,916 | **Command** | `cleanCommand` |
| `remove.ts` | 4,672 | **Command** | `removeCommand` |
| `augment.ts` | 1,091 | **Command** | `augmentCommand` |
| `publish.ts` | 9,238 | **Command** | `publishCommand` |
| `tool.ts` | 6,504 | **Command** | `queryCommand`, `contextCommand`, `impactCommand`, `cypherCommand`, `detectChangesCommand` |
| `eval-server.ts` | 17,095 | **Command** | `evalServerCommand`, 6 `format*` helpers |
| `index-repo.ts` | 4,749 | **Command** | `indexCommand` |
| `group.ts` | 14,966 | **Command** | `registerGroupCommands` |
| `cli-message.ts` | 2,661 | **Utility** | `cliInfo`, `cliWarn`, `cliError` |
| `optional-grammars.ts` | 5,270 | **Utility** | `detectMissingOptionalGrammars`, `warnMissingOptionalGrammars` |
| `ai-context.ts` | 13,950 | **Utility** | `generateAIContextFiles` |

### Server Layer (`src/server/`) — 25 files, 107,226 total bytes

| File | Size | Role | Exports |
|------|------|------|---------|
| `api.ts` | 2,007 | **Entry** | `createServer`, re-exports `handleFileRequest`, `isAllowedOrigin`, `ClientDisconnectedError` |
| **routes/** | | | |
| `routes/index.ts` | 827 | **Barrel** | `mountAllRoutes` |
| `routes/health.ts` | 1,251 | **Route** | `mountHealth` |
| `routes/repos.ts` | 3,763 | **Route** | `mountRepos` |
| `routes/graph.ts` | 6,500 | **Route** | `mountGraph` |
| `routes/query.ts` | 1,345 | **Route** | `mountQuery` |
| `routes/search.ts` | 6,704 | **Route** | `mountSearch` |
| `routes/file.ts` | 5,182 | **Route** | `mountFile`, `handleFileRequest` |
| `routes/processes.ts` | 2,127 | **Route** | `mountProcesses` |
| `routes/analyze.ts` | 9,637 | **Route** | `mountAnalyze` |
| `routes/embedding.ts` | 5,900 | **Route** | `mountEmbedding` |
| **middleware/** | | | |
| `middleware/index.ts` | 747 | **Barrel** | `mountMiddleware` |
| `middleware/cors.ts` | 1,384 | **Middleware** | `isAllowedOrigin`, `corsMiddleware` |
| `middleware/repo-resolver.ts` | 3,697 | **Middleware** | `createRepoResolver`, `createRepoLockManager`, `requestedRepo` |
| `middleware/error-handler.ts` | 707 | **Middleware** | `statusFromError`, `globalErrorHandler` |
| **helpers/** | | | |
| `config.ts` | 1,541 | **Config** | `ServerConfig`, `DEFAULT_SERVER_CONFIG`, `loadConfig` |
| `types.ts` | 523 | **Types** | `ServerDependencies`, `RouteModule` (re-exports `GraphStreamRecord`) |
| `shutdown.ts` | 1,395 | **Helper** | `registerGracefulShutdown` |
| `validation.ts` | 6,733 | **Helper** | `BadRequestError`, `ForbiddenError`, `assertString`, `assertSafePath`, `escapeRegExp`, `createRouteLimiter` |
| `streaming.ts` | 8,586 | **Helper** | `streamGraphNdjson`, `mountSSEProgress`, `ClientDisconnectedError`, `isIgnorableGraphQueryError`, `writeNdjsonRecord`, `ensureStreamIsWritable`, `waitForDrain` |
| `web-ui.ts` | 5,274 | **Helper** | `registerWebUI`, `resolveWebDistDir`, `SPA_FALLBACK_REGEX`, `landingPageHtml`, `staticCacheControlSetHeaders` |
| `mcp-http.ts` | 3,974 | **Helper** | `mountMCPEndpoints` |
| `git-clone.ts` | 17,865 | **Helper** | `cloneOrPull`, `extractRepoName`, `getCloneDir` |
| `analyze-job.ts` | 5,941 | **Helper** | `JobManager`, `AnalyzeJob`, `AnalyzeJobProgress` |
| `analyze-worker.ts` | 2,633 | **Worker** | (fork entry, no public exports) |

## Dependency Edge Counts

| Layer | Total Files | Entry/Barrel | Commands | Utilities | DOT Edges | MMD Edges |
|-------|------------|-------------|----------|-----------|-----------|-----------|
| **CLI** (`src/cli/`) | 22 | 2 (index, lazy-action) | 16 | 4 | **79** | **35** |
| **Server** (`src/server/`) | 25 | 4 (api, routes/index, middleware/index, types) | 9 routes | 12 | **76** | **61** |
| **Core** (referred) | 5 | — | — | — | — | — |
| **Storage** (referred) | 11 | — | — | — | — | — |

### Cross-Layer Import Counts (unique files importing)

| Source Layer → Target Layer | Files |
|-----------------------------|-------|
| CLI → `core/` | 15 of 22 |
| CLI → `storage/` | 9 of 22 |
| CLI → `mcp/` | 3 of 22 (tool.ts, eval-server.ts, group.ts, mcp.ts) |
| CLI → `server/` | 1 (serve.ts → api.ts) |
| Server → `core/` | 14 import statements across routes + helpers |
| Server → `storage/` | 3 (repos.ts, analyze.ts, middleware/repo-resolver.ts) |
| Server → `mcp/` | 4 (api.ts, mcp-http.ts, middleware/repo-resolver.ts, routes/processes.ts) |
| Server → `config/` | 1 (config.ts → config/index.ts) |
| Server → `gitnexus-shared` | 3 (graph.ts, search.ts, streaming.ts) |

## Key Observations

### CLI Layer Architecture

1. **Lazy-loading dispatch pattern**: `index.ts` registers 16 commands via `createLazyAction()`, which defers `import()` until invocation. This keeps cold-start fast — the entry point only statically imports `commander` (180KB), `lazy-action.ts` (847B), `group.ts` (15KB), and `core/environment.ts` (653B).

2. **Two command categories**:
   - **Direct tool commands** (query, context, impact, cypher, detect-changes): All routed through `tool.ts`, which uses `LocalBackend.callTool()` to dispatch.
   - **CLI workflow commands** (analyze, setup, wiki, publish, serve, mcp): Each has its own dedicated module with full orchestration logic.

3. **`serve` and `mcp` bridge to server/MCP layers**: `serve.ts` → `server/api.ts` → `createServer` is the only CLI → Server dependency. `mcp.ts` → `mcp/server.ts` + `mcp/local/local-backend.ts` for MCP mode.

4. **Progress/comms pattern**: `cli-message.ts` provides triple-output (stderr + structured logger) for user-facing messages. `analyze.ts` uses `cli-progress` for its progress bar.

5. **Heaviest core dependencies**: `runFullAnalysis` (imported by analyze.ts and analyze-worker.ts), `logger` (used by 8+ CLI files), `getPortability` (used by setup.ts, ai-context.ts, optional-grammars.ts).

### Server Layer Architecture

1. **Request lifecycle**:
   ```
   api.ts (createServer)
     → mountMiddleware() - cors → json parser → private-network header
     → mountAllRoutes() on a sub-router
       → mountHealth, mountRepos, mountGraph, mountQuery, mountSearch,
         mountFile, mountProcesses, mountAnalyze, mountEmbedding
     → registerWebUI() - SPA fallback or landing page
     → globalErrorHandler() - last resort 500
   ```

2. **Shared resolver pattern**: Almost every route uses `createRepoResolver(backend, jobManager, holdTimeoutMs)` from `middleware/repo-resolver.ts`. This middleware:
   - Resolves `?repo=` or `req.body.repo` to a registered repo entry
   - Waits for in-progress analyze jobs (up to `repoHoldTimeoutMs`)
   - Returns `__timedOut` sentinel for long waits
   - Falls back to `backend.init()` if repo not found

3. **Job-based async operations**: `routes/analyze.ts` and `routes/embedding.ts` both:
   - Create a `JobManager` job
   - Fork a child process (analyze) or run inline pipeline (embed)
   - Stream progress via SSE (`mountSSEProgress` from `streaming.ts`)
   - Support job status query (`GET /api/analyze/:jobId`) and cancellation (`DELETE`)

4. **Core adapter dependency density**: `lbug/lbug-adapter.ts` is the single most-imported external module — 6 server files use it via `withLbugDb`, `executeQuery`, `closeLbug`, `streamQuery`, `executePrepared`, `fetchExistingEmbeddingHashes`, or `flushWAL`.

5. **Static vs dynamic imports**: `routes/search.ts` and `routes/embedding.ts` use dynamic `await import()` for embedding pipeline modules (only loaded when semantic search or embedding generation is actually requested), keeping the server cold-start fast.

6. **Validation layer**: `validation.ts` provides `assertString`, `assertSafePath`, `escapeRegExp`, and `createRouteLimiter` (60 RPM default, per-IP rate limiting with IPv6 /56 subnet normalization).

### Barrel Files (≤ 827 bytes)
- `server/routes/index.ts` (827B) — barrel for 9 route mount functions
- `server/middleware/index.ts` (747B) — barrel for `mountMiddleware`
- `server/types.ts` (523B) — barrel for `ServerDependencies` type
- `cli/lazy-action.ts` (847B) — just over 20 lines but function-like dispatch; marked as dispatch node

### Risk & Safety Notes
- Many CLI commands import directly from `storage/repo-manager.ts` — changes to the storage API affect 9 CLI files directly.
- `server/config.ts` depends on `config/index.ts` (portable config loader) — changing the config schema propagates to server config and all routes.
- The `JobManager` class in `analyze-job.ts` has no interface/abstraction — it's a concrete class used directly by api.ts, routes/analyze.ts, routes/embedding.ts, and middleware/repo-resolver.ts.
