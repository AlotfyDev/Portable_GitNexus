export declare const insertNodeToLbug: (label: string, properties: Record<string, any>, dbPath?: string) => Promise<boolean>;
export declare const batchInsertNodesToLbug: (nodes: Array<{
    label: string;
    properties: Record<string, any>;
}>, dbPath: string) => Promise<{
    inserted: number;
    failed: number;
}>;
export declare const deleteNodesForFile: (filePath: string, dbPath?: string) => Promise<{
    deletedNodes: number;
}>;
