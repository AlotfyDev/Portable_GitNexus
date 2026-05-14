/**
 * Analyze Command
 *
 * Indexes a repository and stores the knowledge graph in .gitnexus/
 *
 * Delegates core analysis to the shared runFullAnalysis orchestrator.
 * This CLI wrapper handles: heap management, progress bar, SIGINT,
 * skill generation (--skills), summary output, and process.exit().
 */
export interface AnalyzeOptions {
    force?: boolean;
    /**
     * Embedding generation toggle. Commander parses `--embeddings [limit]` as:
     *   - `undefined` when the flag is omitted
     *   - `true` when passed without an argument (use default 50K node cap)
     *   - a string when passed with an argument (`--embeddings 0` disables the
     *     cap, `--embeddings <n>` uses `<n>` as the cap)
     */
    embeddings?: boolean | string;
    /**
     * Explicitly drop existing embeddings on rebuild instead of preserving
     * them. Without this flag, a routine `analyze` keeps any embeddings
     * already present in the index even when `--embeddings` is omitted.
     */
    dropEmbeddings?: boolean;
    skills?: boolean;
    verbose?: boolean;
    /** Skip AGENTS.md and CLAUDE.md gitnexus block updates. */
    skipAgentsMd?: boolean;
    /** Omit volatile symbol/relationship counts from AGENTS.md and CLAUDE.md. */
    noStats?: boolean;
    /** Index the folder even when no .git directory is present. */
    skipGit?: boolean;
    /**
     * Override the default basename-derived registry `name` with a
     * user-supplied alias (#829). Disambiguates repos whose paths share a
     * basename. Persisted — subsequent re-analyses of the same path without
     * `--name` preserve the alias.
     */
    name?: string;
    /**
     * Allow registration even when another path already uses the same
     * `--name` alias (#829). Intentionally a distinct flag from `--force`
     * because the user may want to coexist under the same name WITHOUT
     * paying the cost of a pipeline re-index. Maps to registerRepo's
     * `allowDuplicateName` option end-to-end.
     */
    allowDuplicateName?: boolean;
    /**
     * Override the walker's large-file skip threshold (#991). Value in KB;
     * clamped downstream to the tree-sitter 32 MB ceiling. Sets
     * `GITNEXUS_MAX_FILE_SIZE` for the rest of the pipeline.
     */
    maxFileSize?: string;
    /** Override worker sub-batch idle timeout in seconds. */
    workerTimeout?: string;
    embeddingThreads?: string;
    embeddingBatchSize?: string;
    embeddingSubBatchSize?: string;
    embeddingDevice?: string;
    /** Override the source code directory (alternative to positional [path] arg) */
    sourcePath?: string;
    /** Override the output path for .gitnexus/ knowledge graph */
    outputPath?: string;
}
export declare const analyzeCommand: (inputPath?: string, options?: AnalyzeOptions) => Promise<void>;
