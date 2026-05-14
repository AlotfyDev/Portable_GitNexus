import type { WriteStreamFactory, RelCsvSplitResult } from './types.js';
export declare const splitRelCsvByLabelPair: (csvPath: string, csvDir: string, validTables: Set<string>, getNodeLabel: (id: string) => string, wsFactory?: WriteStreamFactory) => Promise<RelCsvSplitResult>;
