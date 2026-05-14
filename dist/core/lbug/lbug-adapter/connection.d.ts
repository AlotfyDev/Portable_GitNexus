import lbug from '@ladybugdb/core';
export declare let conn: lbug.Connection | null;
export declare let db: lbug.Database | null;
export declare let currentDbPath: string | null;
export declare const ensuredFTSIndexes: Set<string>;
export declare function getFtsLoaded(): boolean;
export declare function setFtsLoaded(v: boolean): void;
export declare function getVectorExtensionLoaded(): boolean;
export declare function setVectorExtensionLoaded(v: boolean): void;
export declare const getDatabase: () => lbug.Database | null;
export declare const initLbug: (dbPath: string) => Promise<{
    db: lbug.Database;
    conn: lbug.Connection;
}>;
export declare const withLbugDb: <T>(dbPath: string, operation: () => Promise<T>) => Promise<T>;
export declare const flushWAL: () => Promise<void>;
export declare const safeClose: () => Promise<void>;
export declare const closeLbug: () => Promise<void>;
export declare const isLbugReady: () => boolean;
