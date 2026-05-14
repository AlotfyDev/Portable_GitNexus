import type { SemanticModel } from '../../model/index.js';
import type { ClassDefRef } from '../types.js';
import { extractReturnTypeName } from '../../type-extractors/shared.js';
import { walkParentChain } from './inheritance.js';
import { lookupClassDefsByName } from './class-lookup.js';

export const resolveFieldType = (
  receiver: string,
  field: string,
  scopeEnv: ReadonlyMap<string, string>,
  model?: SemanticModel,
  getClassDefs?: (typeName: string) => ClassDefRef[],
  parentMap?: ReadonlyMap<string, readonly string[]>,
): string | undefined => {
  if (!model) return undefined;
  const receiverType = scopeEnv.get(receiver);
  if (!receiverType) return undefined;
  const lookup = getClassDefs ?? ((name: string) => lookupClassDefsByName(model, name));
  const classDefs = lookup(receiverType);
  if (classDefs.length !== 1) return undefined;
  const fieldDef = model.fields.lookupFieldByOwner(classDefs[0].nodeId, field);
  if (fieldDef?.declaredType) return extractReturnTypeName(fieldDef.declaredType);
  const inherited = walkParentChain(receiverType, parentMap, lookup, (nodeId) => {
    const f = model.fields.lookupFieldByOwner(nodeId, field);
    return f?.declaredType ? extractReturnTypeName(f.declaredType) : undefined;
  });
  return inherited;
};
