import { type ExtensionEnsureOptions } from '../extension-loader.js';
export declare const isMissingColumnOrTableError: (msg: string) => boolean;
export declare const loadFTSExtension: (targetConn?: import("@ladybugdb/core").Connection, opts?: ExtensionEnsureOptions) => Promise<boolean>;
export declare const createFTSIndex: (tableName: string, indexName: string, properties: string[], stemmer?: string) => Promise<void>;
export declare const ensureFTSIndex: (tableName: string, indexName: string, properties: string[], stemmer?: string) => Promise<void>;
export declare const queryFTS: (tableName: string, indexName: string, query: string, limit?: number, conjunctive?: boolean) => Promise<Array<{
    nodeId: string;
    name: string;
    filePath: string;
    score: number;
    [key: string]: any;
}>>;
export declare const dropFTSIndex: (tableName: string, indexName: string) => Promise<void>;
