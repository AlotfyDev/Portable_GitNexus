import type { PipelineId } from './types.js';
export declare const STAGE_IDS: {
    readonly INGESTION: PipelineId;
    readonly LADYBUGDB: PipelineId;
    readonly SEARCH: PipelineId;
    readonly EMBEDDINGS: PipelineId;
    readonly FINALIZE: PipelineId;
};
export declare const STAGE_DEPENDENCIES: Record<string, string[]>;
export interface ResourceRequirement {
    id: string;
    label: string;
    criticality: 'fatal' | 'degrade' | 'warn';
    helpUrl?: string;
}
export declare const STAGE_RESOURCES: Record<string, ResourceRequirement[]>;
export interface ArtifactDescriptor {
    stageId: string;
    dependsOn: string[];
    description: string;
}
export declare const STAGE_ARTIFACTS: ArtifactDescriptor[];
