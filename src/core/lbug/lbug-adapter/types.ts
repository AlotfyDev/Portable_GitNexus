import type { WriteStream } from 'fs';

export type WriteStreamFactory = (filePath: string) => WriteStream;

export interface RelCsvSplitResult {
  relHeader: string;
  relsByPairMeta: Map<string, { csvPath: string; rows: number }>;
  pairWriteStreams: Map<string, WriteStream>;
  skippedRels: number;
  totalValidRels: number;
}

export type LbugProgressCallback = (message: string) => void;
