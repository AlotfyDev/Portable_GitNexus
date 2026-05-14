export declare function isTestFilePath(filePath: string): boolean;
export declare const VALID_NODE_LABELS: Set<string>;
export declare const VALID_RELATION_TYPES: Set<string>;
export declare const IMPACT_RELATION_CONFIDENCE: Readonly<Record<string, number>>;
export declare const confidenceForRelType: (relType: string | undefined) => number;
