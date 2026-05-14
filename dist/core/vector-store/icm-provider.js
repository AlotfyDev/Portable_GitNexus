/**
 * ICM Vector Store Provider
 *
 * Integrates with Portable_ICM (Infinite Context Memory) via its MCP stdio interface.
 * ICM handles embedding storage + vector search internally using SQLite + fastembed.
 *
 * Communication: spawn icm.exe as subprocess, send JSON-RPC via stdin/stdout.
 *
 * MCP tools used:
 *   icm_memory_store   — store a memory (auto-dedup >85%)
 *   icm_memory_recall  — hybrid search (BM25 30% + cosine 70%)
 *   icm_memory_forget  — delete a memory by ID
 *   icm_memory_stats   — global statistics
 *   icm_memory_embed_all — generate all embeddings (batch)
 *
 * Default model: intfloat/multilingual-e5-base (768d)
 * Fallback model: intfloat/multilingual-e5-small (384d)
 */
export class IcmVectorProvider {
    icmPath;
    name = 'icm';
    capabilities = {
        similaritySearch: true,
        hybridSearch: true,
        metadata: true,
        maxDimensions: 768,
        persistent: true,
        windowsCompatible: true,
        requiresExternalServer: false,
    };
    constructor(icmPath) {
        this.icmPath = icmPath;
    }
    async init() {
        // TODO: Spawn icm.exe serve as subprocess
        // Verify it responds to health check
        // Ensure ICM_ROOT and other env vars are set
        throw new Error('Not implemented — requires ICM MCP integration testing');
    }
    async store(records) {
        // TODO: Use icm_memory_store MCP tool for each record
        // Or batch via icm_memory_embed_all
        throw new Error('Not implemented');
    }
    async search(vector, options) {
        // TODO: Use icm_memory_recall MCP tool
        // Pass vector as query embedding
        throw new Error('Not implemented');
    }
    async delete(ids) {
        // TODO: Use icm_memory_forget MCP tool
        throw new Error('Not implemented');
    }
    async count() {
        // TODO: Use icm_memory_stats MCP tool
        throw new Error('Not implemented');
    }
    async clear() {
        // TODO: Use icm_memory_forget_topic MCP tool or prune all
        throw new Error('Not implemented');
    }
    async health() {
        // TODO: Try connecting to ICM, return true if responsive
        throw new Error('Not implemented');
    }
    async dispose() {
        // TODO: Send shutdown to ICM subprocess
        throw new Error('Not implemented');
    }
}
