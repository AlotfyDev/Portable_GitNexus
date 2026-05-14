import type { RepoHandle } from './types.js';
export declare function enrichCandidateLabels(repo: RepoHandle, candidates: Array<{
    id: string;
    type: string;
}>): Promise<void>;
export declare function scoreCandidate(c: {
    kind: string;
    filePath: string;
}, hints: {
    file_path?: string;
    kind?: string;
}): number;
export declare function resolveSymbolCandidates(repo: RepoHandle, query: {
    uid?: string;
    name?: string;
    include_content?: boolean;
}, hints: {
    file_path?: string;
    kind?: string;
}): Promise<{
    kind: 'ok';
    symbol: {
        id: string;
        name: string;
        type: string;
        filePath: string;
        startLine: number;
        endLine: number;
        content?: string;
    };
    resolvedLabel: string;
} | {
    kind: 'ambiguous';
    candidates: Array<{
        id: string;
        name: string;
        type: string;
        filePath: string;
        startLine: number;
        endLine: number;
        score: number;
    }>;
} | {
    kind: 'not_found';
}>;
export declare function aggregateClusters(clusters: any[]): any[];
