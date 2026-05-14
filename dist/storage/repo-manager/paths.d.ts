export declare const canonicalizePath: (p: string) => string;
export declare const getStoragePath: (repoPath: string) => string;
export declare const getStoragePaths: (repoPath: string) => {
    storagePath: string;
    lbugPath: string;
    metaPath: string;
};
export declare const getGlobalDir: () => string;
export declare const getGlobalRegistryPath: () => string;
export declare const getGlobalConfigPath: () => string;
