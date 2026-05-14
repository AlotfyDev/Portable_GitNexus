import type { PositionIndex, ScopeTree } from 'gitnexus-shared';
import type { CaptureMatch, ScopeId, TypeRef } from 'gitnexus-shared';
import type { ScopeDraft, ScopeExtractorHooks } from '../types.js';
import { anchorCaptureFor, rangesEqual } from './capture-utils.js';
import { draftToScope } from './scope-builder.js';

export function pass4CollectTypeBindings(
  matches: readonly CaptureMatch[],
  drafts: readonly ScopeDraft[],
  positionIndex: PositionIndex,
  filePath: string,
  provider: ScopeExtractorHooks,
  scopeTree: ScopeTree,
): void {
  const draftById = new Map<ScopeId, ScopeDraft>();
  for (const d of drafts) draftById.set(d.id, d);

  for (const match of matches) {
    const anchor = anchorCaptureFor(match, '@type-binding.');
    if (anchor === undefined) continue;

    const parsed = provider.interpretTypeBinding?.(match);
    if (parsed === null || parsed === undefined) continue;

    const innermostId = positionIndex.atPosition(
      filePath,
      anchor.range.startLine,
      anchor.range.startCol,
    );
    if (innermostId === undefined) continue;
    const innermost = draftById.get(innermostId);
    if (innermost === undefined) continue;

    const autoHostedId =
      innermost.parent !== null && rangesEqual(anchor.range, innermost.range)
        ? innermost.parent
        : innermost.id;
    const hostId =
      provider.bindingScopeFor?.(match, draftToScope(innermost), scopeTree) ?? autoHostedId;
    const host = draftById.get(hostId) ?? innermost;

    const typeRef: TypeRef = {
      rawName: parsed.rawTypeName,
      declaredAtScope: host.id,
      source: parsed.source,
    };
    const existing = host.typeBindings.get(parsed.boundName);
    if (
      existing === undefined ||
      typeBindingStrength(typeRef.source) >= typeBindingStrength(existing.source)
    ) {
      host.typeBindings.set(parsed.boundName, typeRef);
    }
  }

  for (const draft of drafts) {
    for (const [name, ref] of draft.typeBindings) {
      const resolved = followChainedRef(ref, draftById);
      if (resolved !== ref) draft.typeBindings.set(name, resolved);
    }
  }
}

const CHAIN_MAX_DEPTH = 16;

function followChainedRef(start: TypeRef, draftById: ReadonlyMap<ScopeId, ScopeDraft>): TypeRef {
  let current = start;
  const visited = new Set<string>();
  for (let depth = 0; depth < CHAIN_MAX_DEPTH; depth++) {
    if (current.rawName.includes('.')) return current;

    let scopeId: ScopeId | null = current.declaredAtScope;
    let next: TypeRef | undefined;
    while (scopeId !== null) {
      const scope = draftById.get(scopeId);
      if (scope === undefined) break;
      next = scope.typeBindings.get(current.rawName);
      if (next !== undefined) break;
      scopeId = scope.parent;
    }

    if (next === undefined) return current;
    if (next === current) return current;
    if (visited.has(next.rawName)) return current;
    visited.add(next.rawName);
    current = next;
  }
  return current;
}

function typeBindingStrength(source: TypeRef['source']): number {
  switch (source) {
    case 'annotation':
    case 'parameter-annotation':
    case 'return-annotation':
    case 'self':
      return 2;
    case 'assignment-inferred':
    case 'constructor-inferred':
    case 'receiver-propagated':
      return 1;
    default:
      return 0;
  }
}
