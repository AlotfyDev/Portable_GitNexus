import type { KnowledgeGraph } from '../../../graph/types.js';
import type { ExtractedAssignment, FileConstructorBindings } from '../../workers/parse-worker.js';
import type { ResolutionContext } from '../../model/resolution-context.js';
import type { BindingAccumulator } from '../../binding-accumulator.js';
import type { ReceiverTypeIndex } from '../types.js';
import { CLASS_LIKE_TYPES } from '../constants.js';
import { generateId } from '../../../../lib/utils.js';
import { verifyConstructorBindings } from './constructor-verifier.js';
import { extractFuncNameFromSourceId } from './resolve-call-target.js';
import {
  buildReceiverTypeIndex,
  lookupReceiverType,
  resolveFieldOwnership,
} from './receiver-resolution.js';

export const processAssignmentsFromExtracted = (
  graph: KnowledgeGraph,
  assignments: ExtractedAssignment[],
  ctx: ResolutionContext,
  constructorBindings?: FileConstructorBindings[],
  bindingAccumulator?: BindingAccumulator,
): void => {
  const fileReceiverTypes = new Map<string, ReceiverTypeIndex>();
  if (constructorBindings) {
    for (const { filePath, bindings } of constructorBindings) {
      const verified = verifyConstructorBindings(
        bindings,
        filePath,
        ctx,
        graph,
        bindingAccumulator,
      );
      if (verified.size > 0) {
        fileReceiverTypes.set(filePath, buildReceiverTypeIndex(verified));
      }
    }
  }

  for (const asn of assignments) {
    let receiverTypeName = asn.receiverTypeName;
    if (!receiverTypeName && fileReceiverTypes.size > 0) {
      const receiverMap = fileReceiverTypes.get(asn.filePath);
      if (receiverMap) {
        const funcName = extractFuncNameFromSourceId(asn.sourceId);
        receiverTypeName = lookupReceiverType(receiverMap, funcName, asn.receiverText);
      }
    }
    if (!receiverTypeName) {
      const resolved = ctx.resolve(asn.receiverText, asn.filePath);
      if (resolved?.candidates.some((d) => CLASS_LIKE_TYPES.has(d.type))) {
        receiverTypeName = asn.receiverText;
      }
    }
    if (!receiverTypeName) continue;
    const fieldOwner = resolveFieldOwnership(receiverTypeName, asn.propertyName, asn.filePath, ctx);
    if (!fieldOwner) continue;
    graph.addRelationship({
      id: generateId('ACCESSES', `${asn.sourceId}:${fieldOwner.nodeId}:write`),
      sourceId: asn.sourceId,
      targetId: fieldOwner.nodeId,
      type: 'ACCESSES',
      confidence: 1.0,
      reason: 'write',
    });
  }
};
