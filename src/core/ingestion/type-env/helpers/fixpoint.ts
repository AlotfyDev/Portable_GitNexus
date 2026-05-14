import { FILE_SCOPE, MAX_FIXPOINT_ITERATIONS } from '../constants.js';
import type { ReturnTypeLookup, PendingAssignment } from '../../type-extractors/types.js';
import type { SemanticModel } from '../../model/index.js';
import type { TypeEnv } from '../types.js';
import { logger } from '../../../logger.js';
import { resolveFieldType } from './field-resolution.js';
import { resolveMethodReturnType } from './method-return.js';
import { createClassDefCache } from './class-lookup.js';

export const resolveFixpointBindings = (
  pendingItems: Array<{ scope: string } & PendingAssignment>,
  env: TypeEnv,
  returnTypeLookup: ReturnTypeLookup,
  model?: SemanticModel,
  parentMap?: ReadonlyMap<string, readonly string[]>,
): void => {
  if (pendingItems.length === 0) return;
  const getClassDefs = createClassDefCache(model);
  const resolved = new Set<number>();
  for (let iter = 0; iter < MAX_FIXPOINT_ITERATIONS; iter++) {
    let changed = false;
    for (let i = 0; i < pendingItems.length; i++) {
      if (resolved.has(i)) continue;
      const item = pendingItems[i];
      const scopeEnv = env.get(item.scope);
      if (!scopeEnv || scopeEnv.has(item.lhs)) {
        resolved.add(i);
        continue;
      }

      let typeName: string | undefined;
      switch (item.kind) {
        case 'callResult':
          typeName = item.calleeFqn
            ? returnTypeLookup.lookupReturnType(item.calleeFqn)
            : returnTypeLookup.lookupReturnType(item.callee);
          break;
        case 'copy':
          typeName = scopeEnv.get(item.rhs) ?? env.get(FILE_SCOPE)?.get(item.rhs);
          break;
        case 'fieldAccess':
          typeName = resolveFieldType(
            item.receiver,
            item.field,
            scopeEnv,
            model,
            getClassDefs,
            parentMap,
          );
          break;
        case 'methodCallResult':
          typeName = resolveMethodReturnType(
            item.receiver,
            item.method,
            scopeEnv,
            model,
            getClassDefs,
            parentMap,
          );
          break;
        default: {
          const _exhaustive: never = item;
          break;
        }
      }
      if (typeName) {
        scopeEnv.set(item.lhs, typeName);
        resolved.add(i);
        changed = true;
      }
    }
    if (!changed) break;
    if (iter === MAX_FIXPOINT_ITERATIONS - 1 && process.env.GITNEXUS_DEBUG) {
      const unresolved = pendingItems.length - resolved.size;
      if (unresolved > 0) {
        logger.warn(
          `[type-env] fixpoint hit iteration cap (${MAX_FIXPOINT_ITERATIONS}), ${unresolved} items unresolved`,
        );
      }
    }
  }
};
