import type { ContractExtractor, CypherExecutor } from '../contract-extractor.js';
import type { ExtractedContract, RepoHandle } from '../types.js';
export interface ProtoServiceInfo {
    package: string;
    serviceName: string;
    methods: string[];
    protoPath: string;
}
export declare function buildProtoMap(repoPath: string): Promise<Map<string, ProtoServiceInfo[]>>;
export declare function resolveProtoConflict(serviceName: string, sourceFilePath: string, candidates: ProtoServiceInfo[]): ProtoServiceInfo | null;
export declare function serviceContractId(pkg: string, serviceName: string): string;
export declare class GrpcExtractor implements ContractExtractor {
    type: "grpc";
    canExtract(_repo: RepoHandle): Promise<boolean>;
    extract(_dbExecutor: CypherExecutor | null, repoPath: string, _repo: RepoHandle): Promise<ExtractedContract[]>;
    /**
     * Convert a plugin `GrpcDetection` into a concrete `ExtractedContract`
     * by resolving the short service name against the proto map, building
     * either a service-level (`grpc::pkg.Svc/*`) or method-level
     * (`grpc::pkg.Svc/Method`) contract id, and selecting confidence
     * based on whether the proto map had an entry.
     */
    private detectionToContract;
    private dedupe;
}
