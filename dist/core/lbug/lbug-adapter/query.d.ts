export declare const executeQuery: (cypher: string) => Promise<any[]>;
export declare const streamQuery: (cypher: string, onRow: (row: any) => void | Promise<void>) => Promise<number>;
export declare const executePrepared: (cypher: string, params: Record<string, any>) => Promise<any[]>;
export declare const executeWithReusedStatement: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>;
