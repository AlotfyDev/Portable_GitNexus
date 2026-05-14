/**
 * Shared analysis types extracted from run-analyze.ts.
 * Clean Architecture: types live independently from the orchestrator.
 */
export interface AnalyzeCallbacks {
    onProgress: (phase: string, percent: number, message: string) => void;
    onLog?: (message: string) => void;
}
export interface AnalyzeOptions {
    /**
     * Force a full re-index of the pipeline. Callers may OR this with
     * other flags that imply re-analysis (e.g. `--skills`), so the value
     * here is the PIPELINE-force signal, NOT the registry-collision
     * bypass. See `allowDuplicateName` below.
     */
    force?: boolean;
    embeddings?: boolean;
    /**
     * Override the auto-skip node-count cap for embedding generation.
     * `undefined` (default) keeps the built-in 50,000-node safety limit;
     * `0` disables the cap entirely; any positive integer sets a custom cap.
     * Mapped from the CLI's `--embeddings [limit]` argument.
     */
    embeddingsNodeLimit?: number;
    /**
     * Explicitly drop any embeddings present in the existing index instead of
     * preserving them. Only meaningful when `embeddings` is false/undefined:
     * the default behavior in that case is to load the previously generated
     * embeddings and re-insert them after the rebuild so a routine
     * re-analyze does not silently wipe a long embedding pass.
     */
    dropEmbeddings?: boolean;
    skipGit?: boolean;
    skipAgentsMd?: boolean;
    noStats?: boolean;
    /**
     * User-provided alias for the registry `name`. When set,
     * forwarded to `registerRepo` so the indexed repo is stored under
     * this alias instead of the path-derived basename.
     */
    registryName?: string;
    /**
     * Bypass the `RegistryNameCollisionError` guard and allow two paths
     * to register under the same `name`. Controlled by the
     * dedicated `--allow-duplicate-name` CLI flag, intentionally
     * independent from `--force` — users who hit the collision guard
     * should be able to accept the duplicate without paying the cost
     * of a pipeline re-index.
     */
    allowDuplicateName?: boolean;
}
export interface AnalyzeResult {
    repoName: string;
    repoPath: string;
    stats: {
        files?: number;
        nodes?: number;
        edges?: number;
        communities?: number;
        processes?: number;
        embeddings?: number;
    };
    alreadyUpToDate?: boolean;
    /** The raw pipeline result — only populated when needed by callers (e.g. skill generation). */
    pipelineResult?: any;
}
