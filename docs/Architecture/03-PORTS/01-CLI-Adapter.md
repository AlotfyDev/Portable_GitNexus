# CLI Adapter — Port into the Business Logic Layer

**Path:** `src/cli/` — 23 files
**Framework:** Commander (`^14.0.3`)
**Philosophy:** Thin wrapper parses args → calls Business Logic → formats output. Zero pipeline code, zero direct LadybugDB access.

---

## 1. Architecture

```
gitnexus/src/cli/
├── index.ts                 (246 lines) Commander program def + lazy command registration
├── lazy-action.ts           Lazy import helper (createLazyAction)
├── cli-message.ts           Common CLI message formatting utilities
├── analyze.ts               (682 lines) gitnexus analyze [path]
├── serve.ts                 (59 lines)  gitnexus serve --port --host
├── mcp.ts                   (85 lines)  gitnexus mcp
├── tool.ts                  gitnexus query/context/impact/cypher/detect-changes
├── wiki.ts                  gitnexus wiki [path]
├── group.ts                 gitnexus group  (multi-repo group management)
├── doctor.ts                gitnexus doctor
├── setup.ts                 gitnexus setup
├── skill-gen.ts             gitnexus skill-gen (generate skill files)
├── index-repo.ts            gitnexus index [path...]
├── list.ts                  gitnexus list
├── status.ts                gitnexus status
├── clean.ts                 gitnexus clean
├── remove.ts                gitnexus remove <target>
├── publish.ts               gitnexus publish
├── config.ts                gitnexus config [action] [key] [value]
├── ai-context.ts            gitnexus ai-context
├── augment.ts               gitnexus augment <pattern>
├── eval-server.ts           gitnexus eval-server
├── optional-grammars.ts     Utility: warn about missing optional grammars
└── helper scripts in `src/server/`, `src/mcp/`, `src/core/` (imported, not owned)
```

Lazy loading: `index.ts:7` uses `createLazyAction(() => import('./analyze.js'), 'analyzeCommand')` so heavy deps (tree-sitter, LadybugDB, ONNX) are never loaded for `--help` or fast commands.

---

## 2. Command-to-Business-Logic Mapping

Each command delegates to a single Business Logic entry point. No command contains pipeline DAG construction, LadybugDB queries, embedding logic, or tree-sitter code.

| Command | File | Lines | Delegates To | Business Logic Entry Point |
|---------|------|-------|-------------|---------------------------|
| `analyze` | `src/cli/analyze.ts` | 682 | `src/core/run-analyze.ts` | `runFullAnalysis(repoPath, options, callbacks, config)` — PipelineRunner |
| `serve` | `src/cli/serve.ts` | 59 | `src/server/api.ts` | `createServer(port, host)` — Express HTTP server |
| `mcp` | `src/cli/mcp.ts` | 85 | `src/mcp/server.ts` | `startMCPServer(backend)` — MCP stdio server |
| `tool` | `src/cli/tool.ts` | — | `src/mcp/local/local-backend.ts` | `LocalBackend.callTool(name, args)` — direct tool calls |
| `wiki` | `src/cli/wiki.ts` | — | `src/core/wiki/` | Wiki generation pipeline |
| `group` | `src/cli/group.ts` | — | `src/core/group/` | Group management + Contract Registry |
| `doctor` | `src/cli/doctor.ts` | — | `src/core/platform.ts` | Platform capability inspection |
| `setup` | `src/cli/setup.ts` | — | `src/core/setup/` | MCP editor integration setup |
| `status` | `src/cli/status.ts` | — | `src/storage/repo-manager.ts` | Index status queries |
| `list` | `src/cli/list.ts` | — | `src/storage/repo-manager.ts` | List indexed repos |
| `clean` | `src/cli/clean.ts` | — | `src/storage/repo-manager.ts` | Delete index |
| `remove` | `src/cli/remove.ts` | — | `~/.gitnexus/registry.json` | Unregister repo |
| `publish` | `src/cli/publish.ts` | — | `src/core/publish/` | Index publication |
| `config` | `src/cli/config.ts` | — | `src/config/` | Config management |
| `ai-context` | `src/cli/ai-context.ts` | — | `src/core/analyze/finalizer.ts` | AI context file generation |
| `augment` | `src/cli/augment.ts` | — | `src/core/augment/` | Code augmentation |
| `eval-server` | `src/cli/eval-server.ts` | — | `src/core/eval/` | SWE-bench eval server |
| `skill-gen` | `src/cli/skill-gen.ts` | — | `src/core/ingestion/` | Skill file generation |
| `index` | `src/cli/index-repo.ts` | — | `src/core/run-analyze.ts` | Multi-repo index registration |
| `optional-grammars` | `src/cli/optional-grammars.ts` | — | `vendor/` | Grammar install utility |

---

## 3. CLI → Core Call Chains

### `gitnexus analyze` (Primary Path)
```
src/cli/index.ts:20
  → createLazyAction(() => import('./analyze.js'), 'analyzeCommand')
    → src/cli/analyze.ts:analyzeCommand(path, options)
      → heap re-exec (ensureHeap, 8GB)
      → env setup (embeddings, maxFileSize, worker timeout)
      → progress bar (cli-progress SingleBar)
      → src/core/run-analyze.ts:runFullAnalysis(repoPath, options, callbacks, config)
        → PipelineRunner.runPipelines()
          → [5 PipelineContract stages: ingestion → ladybugdb → search → embeddings → finalize]
      → post-analyze: skill-gen, ai-context, summary
      → process.exit(0)
```

### `gitnexus serve` (Server Start)
```
src/cli/index.ts:96
  → createLazyAction(() => import('./serve.js'), 'serveCommand')
    → src/cli/serve.ts:serveCommand(options)
      → src/server/api.ts:createServer(port, host)
        → Express app setup (middleware, MCP, routes, web UI)
        → app.listen(port, host)
```

### `gitnexus tool` (MCP tool without MCP server)
```
src/cli/index.ts:193 (query subcommand)
  → createLazyAction(() => import('./tool.js'), 'queryCommand')
    → src/cli/tool.ts:queryCommand(searchQuery, options)
      → src/mcp/local/local-backend.ts:LocalBackend.callTool('query', args)
        → helpers/tool-dispatch.ts:dispatchTool(ctx, 'query', args)
          → helpers/search.ts:executeQueryTool(ctx, repo, params)
            → LadybugDB adapter (direct — this is the current violation)
```

---

## 4. What the CLI Does Correctly

The CLI correctly acts as a **thin presentation adapter**:

1. **No pipeline logic** — `analyze.ts:420` calls `runFullAnalysis()` which owns all 5 PipelineContract stages
2. **No LadybugDB queries** — direct query/context/impact/cypher commands delegate to `LocalBackend.callTool()` which dispatches to helpers
3. **No embedding inference** — embedding configuration is passed via env vars to `runFullAnalysis`
4. **No tree-sitter parsing** — file parsing lives in `src/core/ingestion/pipeline.ts`
5. **CLI-only code** is correct UI plumbing: progress bar (`cli-progress`), SIGINT handling, heap management, console routing, colorized output, `cliError()` formatting

**Exception analysis** (`cli/analyze.ts`):
- Lines 302-320: Glob checks for optional grammar files (best-effort warning — acceptable CLI concern)
- Lines 479-525: Post-analyze skill gen + AI context (calls `skill-gen.ts` and `ai-context.ts` — CLI concerns for generating files)
- Lines 542-555: Summary formatting (pure presentation)
- ALL of this is presentation logic, not business logic

---

## 5. Mermaid Call Flow Diagram

```mermaid
sequenceDiagram
    participant User as User Terminal
    participant CLI as src/cli/index.ts<br/>(Commander)
    participant CMD as src/cli/&lt;command&gt;.ts
    participant CORE as src/core/ (Business Logic)
    participant STORAGE as Data / Storage Layer

    User->>CLI: gitnexus analyze ./project
    CLI->>CMD: createLazyAction → analyzeCommand()

    Note over CMD: CLI plumbing: heap, env, progress bar

    CMD->>CORE: runFullAnalysis(path, options, callbacks)

    Note over CORE: PipelineRunner.runPipelines()<br/>5 stages: ingestion→lbug→search→embeddings→finalize

    CORE->>STORAGE: LadybugDB, meta.json, registry
    STORAGE-->>CORE: PipelineResult

    CORE-->>CMD: result (stats, pipelineResult)

    Note over CMD: CLI plumbing: skill-gen, summary, output

    CMD-->>User: Console output + progress bar

    Note over User,STORAGE: CLI path (direct tool): gitnexus query "find auth"

    User->>CLI: gitnexus query "find auth"
    CLI->>CMD: createLazyAction → queryCommand()
    CMD->>CORE: LocalBackend.callTool('query', {query})
    CORE-->>CMD: QueryResult
    CMD-->>User: Formatted JSON output
```

---

## 6. Verification: No Business Logic in CLI

Cross-checked against `src/core/run-analyze.ts:runFullAnalysis`:
- `analyze.ts` imports `runFullAnalysis` at line 24 — zero pipeline DAG construction
- `analyze.ts` imports `closeLbug` at line 15 — ONLY for SIGINT cleanup, never for querying
- `serve.ts` imports `createServer` at line 1 — no database code, no server logic
- `mcp.ts` imports `startMCPServer` dynamically — no MCP protocol handling in CLI

The only borderline case: `analyze.ts:302-320` uses `glob` to check for optional grammar extensions. This is acceptable **best-effort CLI UX** — it only warns, never parses, and the glob runs before any pipeline code.

---

## 7. Cross-References

| Doc | Path | Relevance |
|-----|------|-----------|
| Presentation Layer | `01-LAYERS/01-Presentation-Layer.md:40-83` | CLI layer overview, command table |
| Business Logic Layer | `01-LAYERS/02-Business-Logic-Layer.md` | PipelineContract run-analyze orchestrator |
| MCP Adapter | `03-PORTS/02-MCP-Adapter.md` | CLI tool command delegates to LocalBackend |
| Express Server | `03-PORTS/03-Web-UI-Adapter.md` | CLI serve command starts the Express server |
