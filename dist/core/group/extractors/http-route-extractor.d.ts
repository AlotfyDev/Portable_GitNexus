import type { ContractExtractor, CypherExecutor } from '../contract-extractor.js';
import type { ExtractedContract, RepoHandle } from '../types.js';
/**
 * Canonicalize a provider-side HTTP path for contract-id generation:
 *   - strip query string
 *   - lower-case
 *   - drop trailing slash
 *   - collapse `:id`, `{id}`, `[id]` path params into a single `{param}`
 */
export declare function normalizeHttpPath(p: string): string;
export declare class HttpRouteExtractor implements ContractExtractor {
    type: "http";
    canExtract(_repo: RepoHandle): Promise<boolean>;
    extract(dbExecutor: CypherExecutor | null, repoPath: string, _repo: RepoHandle): Promise<ExtractedContract[]>;
    private scanFiles;
    private extractProvidersGraph;
    private extractProvidersSourceScan;
    private extractConsumersGraph;
    private extractConsumersSourceScan;
    private dedupeContracts;
}
