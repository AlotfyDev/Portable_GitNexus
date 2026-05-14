import type { HeritageMap } from '../../model/index.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { ResolveResult } from '../types.js';

export function findInterfaceDispatchTargets(
  calledName: string,
  receiverTypeName: string,
  currentFile: string,
  ctx: ResolutionContext,
  heritageMap: HeritageMap,
  primaryNodeId: string,
): ResolveResult[] {
  const implFiles = heritageMap.getImplementorFiles(receiverTypeName);
  if (implFiles.size === 0) return [];

  const typeResolved = ctx.resolve(receiverTypeName, currentFile);
  if (!typeResolved) return [];
  if (!typeResolved.candidates.some((c) => c.type === 'Interface')) return [];

  const results: ResolveResult[] = [];
  for (const implFile of implFiles) {
    const methods = ctx.model.symbols.lookupExactAll(implFile, calledName);
    for (const method of methods) {
      if (method.nodeId !== primaryNodeId) {
        results.push({
          nodeId: method.nodeId,
          confidence: 0.7,
          reason: 'interface-dispatch',
        });
      }
    }
  }
  return results;
}
