import type { SemanticModel } from '../../model/index.js';
import type { ClassDefRef } from '../types.js';
import { extractReturnTypeName } from '../../type-extractors/shared.js';
import { walkParentChain } from './inheritance.js';
import { lookupClassDefsByName } from './class-lookup.js';

export const resolveMethodReturnType = (
  receiver: string,
  method: string,
  scopeEnv: ReadonlyMap<string, string>,
  model?: SemanticModel,
  getClassDefs?: (typeName: string) => ClassDefRef[],
  parentMap?: ReadonlyMap<string, readonly string[]>,
): string | undefined => {
  if (!model) return undefined;
  let receiverType = scopeEnv.get(receiver);
  if (!receiverType) {
    const lookup = getClassDefs ?? ((name: string) => lookupClassDefsByName(model, name));
    if (lookup(receiver).length > 0) receiverType = receiver;
  }
  if (!receiverType) return undefined;
  const lookup = getClassDefs ?? ((name: string) => lookupClassDefsByName(model, name));
  const classDefs = lookup(receiverType);
  if (classDefs.length === 0) return undefined;
  const directMethodLookups = classDefs.map((d) => ({
    classDef: d,
    methodDef: model.methods.lookupMethodByOwner(d.nodeId, method),
  }));
  const hasAmbiguousDirectLookup = directMethodLookups.some(({ classDef, methodDef }) => {
    if (methodDef) return false;
    return model.symbols
      .lookupExactAll(classDef.filePath, method)
      .some((d) => d.ownerId === classDef.nodeId);
  });
  if (hasAmbiguousDirectLookup) return undefined;
  const methods = directMethodLookups
    .map(({ methodDef }) => methodDef)
    .filter((d): d is NonNullable<typeof d> => d !== undefined);
  if (methods.length === 1 && methods[0].returnType) {
    return extractReturnTypeName(methods[0].returnType);
  }
  if (methods.length === 0) {
    const inherited = walkParentChain(receiverType, parentMap, lookup, (nodeId) => {
      const parentMethod = model.methods.lookupMethodByOwner(nodeId, method);
      if (!parentMethod?.returnType) return undefined;
      return extractReturnTypeName(parentMethod.returnType);
    });
    return inherited;
  }
  return undefined;
};
