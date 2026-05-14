import type { ExtractedCall } from '../../workers/parse-worker.js';
export declare function seedCrossFileReceiverTypes(calls: ExtractedCall[], namedImportMap: ReadonlyMap<string, ReadonlyMap<string, {
    sourcePath: string;
    exportedName: string;
}>>, exportedTypeMap: ReadonlyMap<string, ReadonlyMap<string, string>>): {
    enrichedCount: number;
};
