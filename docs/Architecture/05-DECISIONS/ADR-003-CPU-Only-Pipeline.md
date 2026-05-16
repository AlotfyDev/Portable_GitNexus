# ADR-003: CPU-Only Pipeline for Current x64 Target

**Status:** Accepted
**Date:** 2026-05-15
**Deciders:** Architecture Team (Agents 1–4)
**Tags:** cpu, gpu, onnx, embeddings, performance, portability

---

## Context

The GitNexus codebase contains several GPU-related code paths that are declared but never consumed:

### Evidence of Aspirational GPU Code

| Location | Code | Status |
|----------|------|--------|
| `src/core/pipeline-contract/stages.ts:3` | `Device` type: `'wasm' \| 'cpu' \| 'cuda' \| 'dml' \| 'remote'` | `'cuda'` and `'dml'` are unused |
| `src/core/portability/contract.ts:54-58` | `hasCuda` flag in PortabilityContract | Declared `false` in both DevContract and PortableContract |
| `src/core/portability/contract.ts:121-125` | `hasCuda()` method | Never called by any consumer |
| `src/core/embeddings/embedding-pipeline.ts:60-70` | `backend: Device` in `EmbeddingConfig` | Always `'cpu'` in dev build, `'wasm'` in portable build |

### Historical Context

The `Device` type and `hasCuda` flag are remnants of an earlier design phase when:
1. **Portable Bun Binary Edition** was being explored (abandoned — relied on Node.js + sidecar)
2. **GPU-accelerated embeddings** were considered for large repos (>50K nodes)
3. **DML (DirectML)** was evaluated for Windows GPU acceleration

None of these paths were ever implemented with concrete code. The types and declarations were left in place as "planned" markers.

### Current Target Environment

| Attribute | Value |
|-----------|-------|
| Platform | x64 CPU with AVX support |
| OS | Windows, macOS, Linux (all x64/arm64) |
| CPU features | AVX, AVX2 (ONNX Runtime uses for matrix multiplication) |
| Memory | 8GB+ recommended (1GB+ for embedding phase) |
| GPU | Not required, not used, not tested |

### Verified CPU-Only Status

| Pipeline Phase | CPU Load | GPU | Memory | Evidence |
|---------------|----------|-----|--------|----------|
| INGESTION (tree-sitter parsing) | Heavy | None | Moderate | CPU-bound, worker pool |
| LADYBUGDB (CSV spool + COPY) | Light | None | Moderate | I/O bound |
| SEARCH (FTS index creation) | Light | None | Low | DB-internal |
| EMBEDDINGS (ONNX inference) | Heavy | None | 1GB+ | `hasCuda`=false, `Device`='cpu' |
| FINALIZE (metadata write) | Light | None | Low | File system I/O |

**Total pipeline: 100% CPU, 0% GPU.**

## Decision

1. **All 5 indexing stages run on CPU only.** No GPU/CUDA/DML acceleration is configured, tested, or supported.
2. **ONNX Runtime CPU inference** is the sole embedding backend. The `e5-small` model (~690MB) uses CPU-based matrix multiplication with AVX extensions where available.
3. **GPU/CUDA code paths are aspirational.** The `Device` type variants `'cuda'` and `'dml'` are kept in the type definition but marked as `// @aspirational — not implemented`. The `hasCuda` flag is kept in `PortabilityContract` but documented as always returning `false`.
4. **No GPU-related issues will be accepted.** The CI environment has no GPU. All tests must pass on CPU. Performance improvements should focus on CPU optimizations (batch sizes, worker pools, incremental processing).
5. **Portable Node.js Edition** (the downstream packaging concern) is unrelated to this decision. If a portable build is ever needed, it would use HTTP embedding endpoints or WASM fallback — not GPU.

## Consequences

### Positive

1. **Simple, predictable resource requirements.** Every installation needs x64 CPU with AVX support and 1GB+ RAM for embeddings. No GPU driver requirements, no CUDA toolkit, no DML runtime.
2. **Works everywhere.** Edge hardware, cloud VMs, CI environments, Docker containers — none need GPU access.
3. **Deterministic behavior.** CPU embeds the same model identically on every platform. GPU would introduce numerical precision variance.
4. **Smaller install footprint.** No need for CUDA drivers (several GB), cuDNN, or TensorRT. ONNX Runtime CPU is ~30MB vs GPU at ~200MB+.

### Negative

1. **Slow for large repos.** The embedding phase at 50K nodes takes significant time on CPU. Benchmark data from `embedding-pipeline.ts` shows ONNX CPU inference at approximately 50-100 tokens/second for `e5-small` on a modern x64 CPU.
2. **No GPU fallback for power users.** A developer with an NVIDIA RTX 4090 cannot accelerate embeddings, even for repos with 100K+ nodes.
3. **The 50K node cap** (`DEFAULT_EMBEDDING_NODE_LIMIT`) exists specifically because CPU embedding is slow. GPU could remove or significantly raise this cap.
4. **Aspirational code is confusing.** Future developers may waste time trying to enable GPU paths that don't work. Clear documentation is essential.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users request GPU support for large repos | High | Medium | Document the path: implement `CudaProvider` implementing `EmbeddingProvider` interface |
| New developer tries to use GPU and fails | Medium | Low | Mark `Device` variants with `@aspirational` JSDoc; add runtime `throw` in embedding-stage if GPU device selected |
| Performance regression from CPU-only ONNX | Low | Medium | Monitor ONNX Runtime CPU releases; they improve CPU inference performance regularly |
| Edge case: ARM Mac MPS (Metal) acceleration | Low | Low | MPS is not CUDA/DML. If MPS support is desired, it would be a new `Device` variant. Not planned. |

## Implementation Guidance

### What to Keep

```typescript
// src/core/pipeline-contract/stages.ts — keep type but annotate
type Device = 'wasm' | 'cpu' | 'cuda' | 'dml' | 'remote';
//                                ^^^^^  ^^^^^  @aspirational — not implemented
```

```typescript
// src/core/portability/contract.ts — keep flag but never set to true
hasCuda: false,  // aspirational, not implemented
```

### What to Remove (Optional — Low Priority)

- References to Bun/gPU in comments across `src/core/portability/portable-config.ts`
- `hasCuda` from `PortableConfig` if it's not consumed anywhere
- Abandoned Bun binary documentation in `docs/`

### Path to Future GPU Support

If GPU support is ever desired:

1. Implement `CudaProvider` implementing `EmbeddingProvider` (`src/core/embeddings/provider.ts`)
2. Add `hasCuda: true` to a new `CudaContract` in `PortabilityContract`
3. Extend `embedding-stage.ts` to select `CudaProvider` when `hasCuda` is true
4. Add ONNX Runtime CUDA provider package: `onnxruntime-server` or `onnxruntime-gpu`
5. Implement `DMLProvider` for Windows DirectML support (for non-NVIDIA GPUs)

This is achievable through the existing `EmbeddingProvider` interface — the abstraction already exists.

## File References

| File | Lines | Content |
|------|-------|---------|
| `src/core/pipeline-contract/stages.ts` | 3 | `Device` type with `'cuda' \| 'dml'` (aspirational) |
| `src/core/portability/contract.ts` | 7-70 | `hasCuda: false` in DevContract (line 56) and PortableContract (line 66) |
| `src/core/embeddings/embedder.ts` | Entire | ONNX CPU inference — no GPU code paths |
| `src/core/embeddings/provider.ts` | Entire | `NativeNodeProvider` (CPU) and HTTP client — no GPU provider |
| `src/core/pipeline-contract/impl/embedding-stage.ts` | 85-188 | ONNX CPU embedding pipeline — `backend: 'cpu'` hard-coded |
| `ui/src/core/llm/agent.ts` | 8-15 | Multi-provider LLM client (OpenAI, Anthropic, Gemini, Ollama) — these are LLM APIs, not GPU inference |

## Cross-References

| Document | Path | Relevance |
|----------|------|-----------|
| Business Logic Layer | `01-LAYERS/02-Business-Logic-Layer.md:6-7` | PortabilityContract + CPU-only status table |
| Data / Storage Layer | `01-LAYERS/03-Data-Storage-Layer.md:7` | CPU-only status by storage component |
| Indexing Pipeline | `02-PIPELINES/01-Indexing-Pipeline.md:8` | CPU-only status by stage |
| Unified Consolidated Report | `.temp_Orchestrator_HandOffs/analysis-00-unified-consolidated-report.md:4.5` | GPU code not consumed — verified |
