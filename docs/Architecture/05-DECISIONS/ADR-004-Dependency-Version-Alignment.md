# ADR-004: Dependency Version Alignment Across Workspace Packages

**Status:** Proposed (pending implementation)
**Date:** 2026-05-15
**Deciders:** Architecture Team (Agents 1–4)
**Tags:** dependencies, alignment, typescript, semver, cleanup

---

## Context

As part of the architecture cleanup (ADR-001: Hexagonal Architecture), dependencies must be aligned so the workspace hoists to single versions where possible and packages reside in the correct layer.

### Current State

Analysis of all three `package.json` files revealed 4 categories of misalignment:

#### Category 1: Version Mismatches

| Package | Root | UI | Shared | Problem |
|---------|------|----|--------|---------|
| **TypeScript** | `^5.4.5` (dev) | `^5.4.5` (dev) | `^6.0.3` (dev) | 🔴 Non-overlapping semver ranges; npm installs two versions |
| **mnemonist** | `^0.40.3` (dep) | `^0.39.0` (dep) | — | 🟡 Non-overlapping sub-1.0 ranges; npm installs two copies |
| **vitest** | `^4.0.18` (dev) | `^4.1.5` (dev) | — | 🟢 Compatible but drifting |
| **@vitest/coverage-v8** | `^4.0.18` (dev) | `^4.1.5` (dev) | — | 🟢 Compatible but drifting |

#### Category 2: Wrong Dependency Category

| Package | Current Location | Correct Location | Reason |
|---------|-----------------|------------------|--------|
| `@rolldown/binding-win32-x64-msvc` | `ui/dependencies` | `ui/devDependencies` | Build-only bundler binding; platform-locked to Windows x64 |

#### Category 3: Dead Dependencies

| Package | Location | Evidence |
|---------|----------|----------|
| `tree-sitter-wasms` | `ui/devDependencies` | Zero imports in any `.ts`, `.tsx`, `.js`, `.mjs` file under `ui/src/` |

#### Category 4: Wrong Layer (must move per ADR-001)

| Package | From | To | Reason |
|---------|------|----|--------|
| `@langchain/core` | `ui/dependencies` | `root/dependencies` | BL owns LLM orchestration |
| `@langchain/anthropic` | `ui/dependencies` | `root/dependencies` | BL owns LLM orchestration |
| `@langchain/google-genai` | `ui/dependencies` | `root/dependencies` | BL owns LLM orchestration |
| `@langchain/langgraph` | `ui/dependencies` | `root/dependencies` | BL owns agentic state machine |
| `@langchain/ollama` | `ui/dependencies` | `root/dependencies` | BL owns LLM orchestration |
| `@langchain/openai` | `ui/dependencies` | `root/dependencies` | BL owns LLM orchestration |
| `langchain` | `ui/dependencies` | `root/dependencies` | BL owns LangChain orchestration |
| `graphology-layout-force` | `ui/dependencies` | `root/dependencies` | Server-side layout calc |
| `graphology-layout-forceatlas2` | `ui/dependencies` | `root/dependencies` | Server-side layout calc |
| `graphology-layout-noverlap` | `ui/dependencies` | `root/dependencies` | Server-side layout calc |

## Decision

### Priority 0 (🔴) — Must Fix, Blocking

| # | Package | Alignment | Action | File(s) | Verification |
|---|---------|-----------|--------|---------|-------------|
| 1 | **TypeScript** | All 3 packages → `^5.7.0` (dev) | Downgrade Shared from `^6.0.3` to `^5.7.0`. Keep Root/UI at `^5.7.0`. | `shared/package.json:27`, `gitnexus/package.json:113`, `ui/package.json:73` | Run `npx tsc --noEmit` in all 3 packages. Verify Shared does not use TS 6-only features (`using`, `await using`, `const` type parameters, `isolatedDeclarations`). If TS 6-only features found, either refactor them or choose Option B (upgrade Root/UI to `^6.0.3`). |

**Why `^5.7.0` and not `^6.0.3`:** TS 6 is very new (released late 2025). The codebase is stable on TS 5.4.5. `^5.7.0` is the latest TS 5.x release with all security and performance fixes but zero breaking changes from 5.4.x. A workspace-wide TS 6 migration should be planned as a separate, coordinated effort.

**Fallback option:** If Shared's codebase is discovered to depend on TS 6-only features that cannot be refactored, upgrade Root and UI to `^6.0.3` instead. This requires verifying Root/UI build and test suite against TS 6.

### Priority 1 (🟡) — Should Fix

| # | Package | Alignment | Action | File(s) | Risk |
|---|---------|-----------|--------|---------|------|
| 2 | **mnemonist** | UI `^0.39.0` → `^0.40.3` | Upgrade UI's mnemonist to match Root. Check API compatibility (0.39 → 0.40 is additive per changelog). | `ui/package.json:44` | LOW — data structures lib, mostly additive |
| 3 | **@rolldown/binding** | `dependencies` → `devDependencies` | Move `@rolldown/binding-win32-x64-msvc` from `dependencies` to `devDependencies`. If platform binding issue persists, add all platform variants as `optionalDependencies` with `os` filters. | `ui/package.json:27` | MEDIUM — Windows build may fail if binding not resolved transitively |
| 4 | **@langchain/\* + langchain** | `ui/dependencies` → `root/dependencies` | Move all 7 packages from UI to Root. After move, verify `ui/src/core/llm/` has no imports of these packages (agent moves to Root). | `ui/package.json:21-26,40`, `gitnexus/package.json` | HIGH — See ADR-001 for full migration plan |
| 5 | **graphology-layout-\*** | `ui/dependencies` → `root/dependencies` | Move 3 layout packages from UI to Root. After move, UI falls back to browser-side layout if server-side cache is absent. | `ui/package.json:36-38`, `gitnexus/package.json` | MEDIUM — See ADR-002 for Boost Pipeline plan |

### Priority 2 (🟢) — Should Fix, Low Risk

| # | Package | Alignment | Action | File(s) | Notes |
|---|---------|-----------|--------|---------|-------|
| 6 | **tree-sitter-wasms** | Remove from UI | Delete `"tree-sitter-wasms": "^0.1.13"` from `ui/devDependencies`. | `ui/package.json:72` | Dead dependency (zero imports). Saves ~5 MB in install. |
| 7 | **vitest** | Align to `^4.0.18` | Downgrade UI `vitest`/`@vitest/coverage-v8` from `^4.1.5` to `^4.0.18` (or upgrade both to `^4.1.5`). | `ui/package.json:74-75`, `gitnexus/package.json:112,114` | Compatible now but drifting. Prefer Root's version since UI tests are fewer. |

### Implementation Order

The migrations must be done in a specific order to avoid breaking builds:

```
Phase 1: TypeScript alignment (P0)
  1. Audit Shared for TS 6-only features
  2. If none found → downgrade Shared to ^5.7.0
  3. Run npx tsc --noEmit && npm test across all 3 packages
  ⚠️ VERIFY BUILD GREEN before proceeding

Phase 2: Category corrections (P1, P2)
  4. Remove tree-sitter-wasms from UI devDependencies
  5. Move @rolldown/binding to UI devDependencies
  6. Align mnemonist in UI to ^0.40.3
  7. Align vitest/@vitest/coverage-v8 to ^4.0.18

Phase 3: Code moves (P1, after ADR-001 code migration)
  8. Move @langchain/* + langchain from UI to Root
  9. Move graphology-layout-* from UI to Root

Phase 4: Clean up
  10. npm install to update lockfile
  11. Run full test suite
  12. Run npx tsc --noEmit across all packages
```

## Consequences

### Positive

1. **Single TypeScript version** — No more dual installs. All three packages use TS 5.7.x. Shared's `.d.ts` files are emitted with the same TS version Root/UI uses to consume them.
2. **Unified mnemonist at ^0.40.3** — Eliminates duplicate install (~40 KB). All code uses the same API surface.
3. **Correct dependency categories** — Build-only tools in `devDependencies`. Platform bindings handled correctly. No platform lock on Windows.
4. **UI bundle shrinks** — Removing `@langchain/*` (~15+ MB), `graphology-layout-*` (~200 KB), and `tree-sitter-wasms` (~5 MB) reduces UI install size significantly.
5. **Root gets LangChain** — The Graph RAG agent and its LLM provider packages move from UI to Root, enabling server-side agent execution without HTTP round-trips.

### Negative

1. **TypeScript alignment risk** — If Shared uses TS 6-only features (`using`, `const` type parameters, new `lib` entries), the downgrade breaks Shared's build. Mitigation: audit first.
2. **LangChain adds ~15+ MB to Root `node_modules`** — This makes production installs larger. But since the agent is server-side functionality that replaces the browser-side agent, the total installed size across the workspace may remain similar or decrease.
3. **Rolling back is difficult** — Once packages are removed from UI and agents are migrated, reverting requires re-adding UI packages and re-migrating agent code. Careful version control discipline is essential.
4. **Bus factor** — These are mechanical but far-reaching changes. A single engineer should own the entire migration across phases 1-4.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shared uses TS 6-only features | Low | 🔴 Blocking | Audit first; if found, upgrade all to TS 6 instead |
| UI build breaks after removing `@langchain/*` | Low | 🔴 High | Remove source imports FIRST, then remove packages. Verify `npx tsc -b --noEmit` between each removal. |
| `graphology-layout-*` removal breaks UI graph rendering | Medium | 🟡 Medium | Keep `graphology-layout-*` in UI as optional fallback. UI checks `meta.json#layout` and falls back to browser-side calc. |
| Rollback is complex if Phase 3 fails | Medium | 🟡 Medium | Each phase is a separate PR. Phase 3 (code moves) is the most complex and should be the last PR. |

## File References

### TypeScript Mismatch

| File | Line | Current | Proposed |
|------|------|---------|----------|
| `shared/package.json` | 27 | `"typescript": "^6.0.3"` | `"typescript": "^5.7.0"` |
| `gitnexus/package.json` | 113 | `"typescript": "^5.4.5"` | `"typescript": "^5.7.0"` |
| `ui/package.json` | 73 | `"typescript": "^5.4.5"` | `"typescript": "^5.7.0"` |

### mnemonist Mismatch

| File | Line | Current | Proposed |
|------|------|---------|----------|
| `ui/package.json` | 44 | `"mnemonist": "^0.39.0"` | `"mnemonist": "^0.40.3"` |
| `gitnexus/package.json` | 75 | `"mnemonist": "^0.40.3"` | Keep |

### Package Migrations

| File | Line | Current | Proposed |
|------|------|---------|----------|
| `ui/package.json` | 21-26, 40 | 7 `@langchain/*` + `langchain` in `dependencies` | Remove; add to `gitnexus/package.json` |
| `ui/package.json` | 36-38 | 3 `graphology-layout-*` in `dependencies` | Remove; add to `gitnexus/package.json` |
| `ui/package.json` | 27 | `@rolldown/binding-win32-x64-msvc` in `dependencies` | Move to `devDependencies` or remove |
| `ui/package.json` | 72 | `"tree-sitter-wasms": "^0.1.13"` in `devDependencies` | Remove |

### vitest Drift

| File | Line | Current | Proposed |
|------|------|---------|----------|
| `ui/package.json` | 74-75 | `"vitest": "^4.1.5"`, `"@vitest/coverage-v8": "^4.1.5"` | `"^4.0.18"` |
| `gitnexus/package.json` | 112, 114 | `"vitest": "^4.0.18"`, `"@vitest/coverage-v8": "^4.0.18"` | Keep |

## Cross-References

| Document | Path | Relevance |
|----------|------|-----------|
| Dependency Matrix | `04-DEPENDENCIES/01-Dependency-Matrix.md` | Full matrix with Section E (Migration Plan) and Section F (Cleanup Impact) |
| ADR-001 | `05-DECISIONS/ADR-001-Unified-Business-Logic-Layer.md` | LangChain + graph layout moves are driven by Hexagonal Architecture |
| Unified Consolidated Report | `.temp_Orchestrator_HandOffs/analysis-00-unified-consolidated-report.md` | Section 4: Critical Findings (TypeScript, mnemonist, rolldown) |
| Dependency Matrix Report | `.temp_Orchestrator_HandOffs/analysis-01-dependency-matrix.md` | Full analysis with version ranges and migration recommendations |
