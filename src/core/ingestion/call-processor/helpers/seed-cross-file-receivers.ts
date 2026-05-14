import type { ExtractedCall } from '../../workers/parse-worker.js';

export function seedCrossFileReceiverTypes(
  calls: ExtractedCall[],
  namedImportMap: ReadonlyMap<
    string,
    ReadonlyMap<string, { sourcePath: string; exportedName: string }>
  >,
  exportedTypeMap: ReadonlyMap<string, ReadonlyMap<string, string>>,
): { enrichedCount: number } {
  if (namedImportMap.size === 0 || exportedTypeMap.size === 0) {
    return { enrichedCount: 0 };
  }
  let enrichedCount = 0;
  for (const call of calls) {
    if (call.receiverTypeName || !call.receiverName) continue;
    if (call.callForm !== 'member') continue;

    const fileImports = namedImportMap.get(call.filePath);
    if (!fileImports) continue;

    const binding = fileImports.get(call.receiverName);
    if (!binding) continue;

    const upstream = exportedTypeMap.get(binding.sourcePath);
    if (!upstream) continue;

    const type = upstream.get(binding.exportedName);
    if (type) {
      call.receiverTypeName = type;
      enrichedCount++;
    }
  }
  return { enrichedCount };
}
