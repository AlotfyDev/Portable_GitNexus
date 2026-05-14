import type { AnalyzeOptions, AnalyzeCallbacks } from '../analyze/types.js';
import type { PortableConfig } from '../../config/types.js';
export type PipelineId = string & {
    readonly __pipeline: unique symbol;
};
export declare const pid: <T extends string>(id: T) => PipelineId;
export interface ArtifactRecord {
    version: number;
    fingerprint: string;
    producedAt: string;
    clean: boolean;
}
export interface ArtifactFingerprint {
    version: number;
    compute: (ctx: PipelineContext) => string;
}
export interface ResourceDeclaration {
    id: string;
    label: string;
    criticality: 'fatal' | 'degrade' | 'warn';
    helpUrl?: string;
    check: () => ResourceCheckResult;
}
export type ResourceCheckResult = {
    available: true;
    detail?: string;
} | {
    available: false;
    reason: string;
    suggest?: string;
};
export type CachePayload = {
    type: 'none';
} | {
    type: 'embeddings';
    data: {
        embeddings: unknown[];
        totalNodes: number;
    };
};
export interface PipelineContext {
    repoPath: string;
    storagePath: string;
    lbugPath: string;
    options: AnalyzeOptions;
    callbacks: AnalyzeCallbacks;
    results: Map<PipelineId, unknown>;
    tempDir: string;
    config?: PortableConfig;
    log: (msg: string) => void;
    progress: (phase: string, percent: number, message: string) => void;
}
export interface PreflightResult {
    ready: boolean;
    fresh: boolean;
    resources: Array<{
        id: string;
        status: ResourceCheckResult;
    }>;
    message?: string;
}
export interface PipelineContract<TOutput = unknown> {
    id: PipelineId;
    label: string;
    deps: PipelineId[];
    artifact?: ArtifactFingerprint;
    resources: ResourceDeclaration[];
    onBeforeInvalidation?: (ctx: PipelineContext) => Promise<CachePayload>;
    onRestore?: (ctx: PipelineContext, cache: CachePayload) => Promise<void>;
    run(ctx: PipelineContext): Promise<TOutput>;
}
export interface PipelineRunOptions {
    force?: boolean;
    only?: PipelineId[];
    skip?: PipelineId[];
    failFast?: boolean;
}
export interface PipelineRunReport {
    results: ReadonlyMap<PipelineId, {
        output: unknown;
        artifact: ArtifactRecord | undefined;
        durationMs: number;
    }>;
    skipped: PipelineId[];
    failed: PipelineId[];
    fresh: PipelineId[];
}
export interface PipelineRunner {
    resolveOrder(ids?: PipelineId[]): PipelineId[][];
    runPipelines(ctx: PipelineContext, options: PipelineRunOptions): Promise<PipelineRunReport>;
}
