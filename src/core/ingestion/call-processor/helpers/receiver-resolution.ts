import type { ResolutionContext } from '../../model/resolution-context.js';
import type { HeritageMap } from '../../model/index.js';
import type { SymbolDefinition } from 'gitnexus-shared';
import type { ResolutionTier } from '../../model/resolution-context.js';
import { CLASS_LIKE_TYPES } from '../constants.js';
import { lookupMethodByOwnerWithMRO } from '../../model/index.js';
import { getLanguageFromFilename } from 'gitnexus-shared';
import { getProvider } from '../../languages/index.js';
import { orderProviderSameNameTypeCandidates } from './provider-primary-resolver.js';
import type { ReceiverTypeEntry, ReceiverTypeIndex, FieldResolution } from '../types.js';
import { stripNullable } from '../../type-extractors/shared.js';

export const receiverKey = (scope: string, varName: string): string => `${scope}\0${varName}`;

export const buildReceiverTypeIndex = (map: Map<string, string>): ReceiverTypeIndex => {
  const index: ReceiverTypeIndex = new Map();
  for (const [key, typeName] of map) {
    const nul = key.indexOf('\0');
    if (nul < 0) continue;
    const scope = key.slice(0, nul);
    const varName = key.slice(nul + 1);
    if (!varName) continue;
    if (scope !== '' && !scope.includes('@')) continue;
    const funcName = scope === '' ? '' : scope.slice(0, scope.indexOf('@'));

    let varMap = index.get(funcName);
    if (!varMap) {
      varMap = new Map();
      index.set(funcName, varMap);
    }

    const existing = varMap.get(varName);
    if (existing === undefined) {
      varMap.set(varName, { kind: 'resolved', value: typeName });
    } else if (existing.kind === 'resolved' && existing.value !== typeName) {
      varMap.set(varName, { kind: 'ambiguous' });
    }
  }
  return index;
};

export const lookupReceiverType = (
  index: ReceiverTypeIndex,
  funcName: string,
  varName: string,
): string | undefined => {
  const funcBucket = index.get(funcName);
  if (funcBucket) {
    const entry = funcBucket.get(varName);
    if (entry?.kind === 'resolved') return entry.value;
    if (entry?.kind === 'ambiguous') {
      const fileEntry = index.get('')?.get(varName);
      return fileEntry?.kind === 'resolved' ? fileEntry.value : undefined;
    }
  }
  if (funcName !== '') {
    const fileEntry = index.get('')?.get(varName);
    if (fileEntry?.kind === 'resolved') return fileEntry.value;
  }
  return undefined;
};

export const resolveFieldAccessType = (
  receiverName: string,
  fieldName: string,
  filePath: string,
  ctx: ResolutionContext,
): FieldResolution | undefined => {
  const fieldDef = resolveFieldOwnership(receiverName, fieldName, filePath, ctx);
  if (!fieldDef?.declaredType) return undefined;

  return {
    typeName: stripNullable(fieldDef.declaredType),
    fieldNodeId: fieldDef.nodeId,
  };
};

export const resolveFieldOwnership = (
  receiverName: string,
  fieldName: string,
  filePath: string,
  ctx: ResolutionContext,
): { nodeId: string; declaredType?: string } | undefined => {
  const typeResolved = ctx.resolve(receiverName, filePath);
  if (!typeResolved) return undefined;
  const classDef = typeResolved.candidates.find((d) => CLASS_LIKE_TYPES.has(d.type));
  if (!classDef) return undefined;

  return ctx.model.fields.lookupFieldByOwner(classDef.nodeId, fieldName) ?? undefined;
};

export const resolveMethodByOwner = (
  receiverTypeName: string,
  methodName: string,
  filePath: string,
  ctx: ResolutionContext,
  heritageMap?: HeritageMap,
  argCount?: number,
  ancestryView?: 'instance' | 'singleton',
): { def: SymbolDefinition; tier: ResolutionTier } | undefined => {
  const typeResolved = ctx.resolve(receiverTypeName, filePath);
  if (!typeResolved) return undefined;

  const language = heritageMap ? getLanguageFromFilename(filePath) : null;
  const mroStrategy = language != null ? getProvider(language).mroStrategy : null;
  const canWalkMRO = heritageMap != null && mroStrategy != null;

  let firstDef: SymbolDefinition | undefined;
  let ambiguous = false;
  for (const candidate of typeResolved.candidates) {
    if (!CLASS_LIKE_TYPES.has(candidate.type)) continue;
    const singletonOverride =
      ancestryView === 'singleton' && canWalkMRO && heritageMap
        ? heritageMap.getSingletonAncestry(candidate.nodeId).map((e) => e.parentId)
        : undefined;
    const def = canWalkMRO
      ? lookupMethodByOwnerWithMRO(
          candidate.nodeId,
          methodName,
          heritageMap,
          ctx.model,
          mroStrategy,
          argCount,
          singletonOverride,
        )
      : ctx.model.methods.lookupMethodByOwner(candidate.nodeId, methodName, argCount);
    if (!def) continue;
    if (!firstDef) {
      firstDef = def;
    } else if (def.nodeId !== firstDef.nodeId) {
      ambiguous = true;
      break;
    }
  }

  if (!firstDef && !ambiguous) {
    const orderedTypeCandidates = orderProviderSameNameTypeCandidates(
      ctx.model.types.lookupClassByName(receiverTypeName),
      receiverTypeName,
      filePath,
    );
    if (orderedTypeCandidates) {
      for (const candidate of orderedTypeCandidates) {
        const def = canWalkMRO
          ? lookupMethodByOwnerWithMRO(
              candidate.nodeId,
              methodName,
              heritageMap,
              ctx.model,
              mroStrategy,
              argCount,
            )
          : ctx.model.methods.lookupMethodByOwner(candidate.nodeId, methodName, argCount);
        if (!def) continue;
        if (!firstDef) {
          firstDef = def;
        } else if (def.nodeId !== firstDef.nodeId) {
          ambiguous = true;
          break;
        }
      }
    }
  }

  if (!firstDef || ambiguous) return undefined;
  return { def: firstDef, tier: typeResolved.tier };
};
