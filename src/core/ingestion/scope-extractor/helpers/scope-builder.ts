import { canParentScope, makeScopeId } from 'gitnexus-shared';
import type {
  CaptureMatch,
  Scope,
  ScopeId,
  ScopeKind,
  Range,
  BindingRef,
  SymbolDefinition,
  ImportEdge,
  TypeRef,
} from 'gitnexus-shared';
import type { ScopeDraft, ScopeExtractorHooks } from '../types.js';
import { anchorCaptureFor } from './capture-utils.js';

function makeDraft(
  id: ScopeId,
  parent: ScopeId | null,
  kind: ScopeKind,
  range: Range,
  filePath: string,
): ScopeDraft {
  return {
    id,
    parent,
    kind,
    range,
    filePath,
    bindings: new Map(),
    ownedDefs: [],
    imports: [],
    typeBindings: new Map(),
  };
}

export function draftToScope(draft: ScopeDraft): Scope {
  const frozenBindings = new Map<string, readonly BindingRef[]>();
  for (const [name, refs] of draft.bindings) {
    frozenBindings.set(name, Object.freeze(refs.slice()));
  }
  return {
    id: draft.id,
    parent: draft.parent,
    kind: draft.kind,
    range: draft.range,
    filePath: draft.filePath,
    bindings: frozenBindings,
    ownedDefs: Object.freeze(draft.ownedDefs.slice()),
    imports: Object.freeze(draft.imports.slice()),
    typeBindings: new Map(draft.typeBindings),
  };
}

export function pass1BuildScopes(
  matches: readonly CaptureMatch[],
  filePath: string,
  provider: ScopeExtractorHooks,
): ScopeDraft[] {
  interface Candidate {
    readonly match: CaptureMatch;
    readonly range: Range;
    readonly kind: ScopeKind;
    readonly id: ScopeId;
  }

  const candidates: Candidate[] = [];
  for (const match of matches) {
    const anchor = anchorCaptureFor(match, '@scope.');
    if (anchor === undefined) continue;
    const kind = resolveKindForScopeMatch(match, anchor, provider);
    if (kind === null) continue;
    const id = makeScopeId({ filePath, range: anchor.range, kind });
    candidates.push({ match, range: anchor.range, kind, id });
  }

  candidates.sort((a, b) => {
    if (a.range.startLine !== b.range.startLine) return a.range.startLine - b.range.startLine;
    if (a.range.startCol !== b.range.startCol) return a.range.startCol - b.range.startCol;
    if (a.range.endLine !== b.range.endLine) return b.range.endLine - a.range.endLine;
    if (a.range.endCol !== b.range.endCol) return b.range.endCol - a.range.endCol;
    if (a.kind === b.kind) return 0;
    if (a.kind === 'Module') return -1;
    if (b.kind === 'Module') return 1;
    return 0;
  });

  const drafts: ScopeDraft[] = [];
  const stack: Candidate[] = [];

  for (const cand of candidates) {
    while (
      stack.length > 0 &&
      !canParentScope(
        stack[stack.length - 1]!.range,
        cand.range,
        stack[stack.length - 1]!.kind,
        cand.kind,
      )
    ) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1]!.id : null;
    drafts.push(makeDraft(cand.id, parent, cand.kind, cand.range, filePath));
    stack.push(cand);
  }

  return drafts;
}

export function ensureModuleScope(
  scopeDrafts: ScopeDraft[],
  matchCount: number,
  filePath: string,
): ScopeDraft {
  const moduleScope = scopeDrafts.find((s) => s.kind === 'Module');
  if (moduleScope !== undefined) return moduleScope;

  if (scopeDrafts.length === 0 && matchCount === 0) {
    const range: Range = { startLine: 0, startCol: 0, endLine: 0, endCol: 0 };
    const synthetic = makeDraft(
      makeScopeId({ filePath, range, kind: 'Module' }),
      null,
      'Module',
      range,
      filePath,
    );
    scopeDrafts.push(synthetic);
    return synthetic;
  }

  throw new Error(
    `ScopeExtractor: no Module scope found for '${filePath}'. ` +
      `Provider must emit at least one @scope.module capture per file.`,
  );
}

function resolveKindForScopeMatch(
  match: CaptureMatch,
  anchor: { readonly name: string },
  provider: ScopeExtractorHooks,
): ScopeKind | null {
  const override = provider.resolveScopeKind?.(match);
  if (override !== undefined && override !== null) return override;

  const suffix = anchor.name.slice('@scope.'.length);
  switch (suffix.toLowerCase()) {
    case 'module':
      return 'Module';
    case 'namespace':
      return 'Namespace';
    case 'class':
      return 'Class';
    case 'function':
      return 'Function';
    case 'block':
      return 'Block';
    case 'expression':
      return 'Expression';
    default:
      return null;
  }
}
