# GitNexus Holistic Architecture Views

Generated from `D:\Agent_Skills\GitNexus\gitnexus\src\` — all edges are based on **actual import statement analysis**.

## File Inventory

| File | Type | Description |
|------|------|-------------|
| `01-gitnexus-holistic-layers.dot` | Graphviz DOT | All 9 architectural layers with color coding: blue=CLI, green=Server/MCP, orange=Core, purple=Storage, gray=Infra. Every major file in `src/` is a node. Edges labeled with import/flow names. |
| `02-gitnexus-holistic-layers.mmd` | Mermaid | Same as above in Mermaid format. |
| `03-gitnexus-portable-variants.dot` | Graphviz DOT | Bun portable binary (~154 MB, requires AVX) vs Node.js npm package (~80 MB, no AVX). Shows shared layer and variant-exclusive components (WASM grammars vs native .node addons, PortableContract vs DevContract, etc.). |
| `04-gitnexus-portable-variants.mmd` | Mermaid | Same as above in Mermaid format. |
| `05-gitnexus-core-domains.dot` | Graphviz DOT | Deep dive into 7 core domains: Ingestion Pipeline (14-phase dependency chain), Embeddings Pipeline, Portability (contract interface + 2 impls), LadybugDB, Vector Store, Search, and Group/Multi-Repo. Shows internal sub-components and inter-domain edges. |
| `06-gitnexus-core-domains.mmd` | Mermaid | Same as above in Mermaid format. |
| `07-gitnexus-data-flow.dot` | Graphviz DOT | Complete data-flow diagrams for all 3 major paths: (1) Indexing write path — User → CLI → Pipeline → KnowledgeGraph → LadybugDB → Embeddings → Finalize, (2) Query read path — MCP/HTTP → LocalBackend → LadybugDB → Result, (3) Server/Wiki auxiliary paths. |
| `08-gitnexus-data-flow.mmd` | Mermaid | Same as above in Mermaid format. |

## Rendering

### Graphviz (.dot) → PNG/SVG

```bash
dot -Tpng 01-gitnexus-holistic-layers.dot -o 01-gitnexus-holistic-layers.png
dot -Tpng 03-gitnexus-portable-variants.dot -o 03-gitnexus-portable-variants.png
dot -Tpng 05-gitnexus-core-domains.dot -o 05-gitnexus-core-domains.png
dot -Tpng 07-gitnexus-data-flow.dot -o 07-gitnexus-data-flow.png
```

### Mermaid (.mmd) → render via mermaid-cli or GitHub

```bash
npx @mermaid-js/mermaid-cli mmdc -i 02-gitnexus-holistic-layers.mmd -o 02-gitnexus-holistic-layers.png
```

## Patterns Discovered

### Layer Dependencies (observed from import analysis)

| Layer | Depends on | Notes |
|-------|-----------|-------|
| `cli/` | `core/`, `storage/` | CLI imports analysis orchestrator and repo management |
| `server/` | `core/`, `storage/`, `mcp/`, `config/` | Server is the integration hub |
| `mcp/` | `core/`, `storage/`, `config/` | MCP is independent of `server/` (can run standalone) |
| `core/` | `generated/`, `config/`, `storage/`, `lib/`, `mcp/`, `types/` | Core has the widest reach |
| `config/` | `core/portability/` | Config imports portability contract |
| `storage/` | Self | No external layer imports |
| `types/` | `core/ingestion/` | Imports process/community types |

### Notable Findings

1. **Core → MCP reverse dependency**: `core/ingestion/` imports `mcp/stdio-capture.ts` for stdout sentinel access — a layer inversion worth noting.

2. **No circular dependencies detected** at the layer level (all imports flow in one direction).

3. **Portability is a first-class concern**: The `IS_PORTABLE_BUILD` flag in `generated/constants.ts` propagates through `PortabilityContract`, `PortableConfig`, and platform capabilities to conditionally disable native addons, worker pools, and the Leiden algorithm in the Bun build.

4. **Two embedding backends**: Dev (onnxruntime-node native) vs Portable (WASM ONNX or HTTP). Dispatched transparently via `PortabilityContract.hasOnnxRuntimeNode` and `PortabilityContract.hasHttpEmbeddings`.

5. **Pipeline has 14 phases** in a directed acyclic graph with explicit dependency ordering. The phases `mro`, `communities`, and `processes` can be skipped via `--skip-graph-phases` for faster testing.

6. **LadybugDB is the single persistence layer**: Both FTS indexes and vector indexes coexist in the same `.gitnexus/{name}/lbug.lb` database. KuzuDB was the previous backend and cleanup support still exists in the codebase.

7. **Group/Multi-repo support sits atop LadybugDB**: The Contract Bridge and cross-impact analysis use a separate bridge database file alongside the per-repo LadybugDB databases.
