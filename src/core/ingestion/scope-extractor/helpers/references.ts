import type { PositionIndex, ScopeTree } from 'gitnexus-shared';
import type { CaptureMatch, ReferenceSite, ReferenceKind, ScopeId } from 'gitnexus-shared';
import type { ScopeExtractorHooks } from '../types.js';
import { anchorCaptureFor } from './capture-utils.js';

export function pass5CollectReferences(
  matches: readonly CaptureMatch[],
  positionIndex: PositionIndex,
  filePath: string,
  referenceSites: ReferenceSite[],
  provider: ScopeExtractorHooks,
  scopeTree: ScopeTree,
): void {
  for (const match of matches) {
    const anchor = anchorCaptureFor(match, '@reference.');
    if (anchor === undefined) continue;

    const kind = referenceKindFromAnchor(anchor.name);
    if (kind === undefined) continue;

    const nameCap = match['@reference.name'] ?? anchor;
    const inScopeId = positionIndex.atPosition(
      filePath,
      anchor.range.startLine,
      anchor.range.startCol,
    );
    if (inScopeId === undefined) continue;

    const callForm =
      kind === 'call'
        ? classifyCallFormForMatch(match, anchor.name, provider, scopeTree, inScopeId)
        : undefined;
    const explicitReceiver = extractExplicitReceiver(match);
    const arity = extractArity(match);
    const argumentTypes = extractArgumentTypes(match);

    const site: ReferenceSite = {
      name: nameCap.text,
      atRange: anchor.range,
      inScope: inScopeId,
      kind,
      ...(callForm !== undefined ? { callForm } : {}),
      ...(explicitReceiver !== undefined ? { explicitReceiver } : {}),
      ...(arity !== undefined ? { arity } : {}),
      ...(argumentTypes !== undefined ? { argumentTypes } : {}),
    };
    referenceSites.push(site);
  }
}

function referenceKindFromAnchor(name: string): ReferenceKind | undefined {
  const suffix = name.slice('@reference.'.length);
  const firstDot = suffix.indexOf('.');
  const head = firstDot === -1 ? suffix : suffix.slice(0, firstDot);
  switch (head.toLowerCase()) {
    case 'call':
      return 'call';
    case 'read':
      return 'read';
    case 'write':
      return 'write';
    case 'type':
    case 'type_reference':
      return 'type-reference';
    case 'inherits':
      return 'inherits';
    case 'import_use':
    case 'import-use':
      return 'import-use';
    default:
      return undefined;
  }
}

function classifyCallFormForMatch(
  match: CaptureMatch,
  anchorName: string,
  provider: ScopeExtractorHooks,
  scopeTree: ScopeTree,
  inScopeId: ScopeId,
): 'free' | 'member' | 'constructor' | 'index' {
  const suffix = anchorName.slice('@reference.call.'.length);
  switch (suffix.toLowerCase()) {
    case 'free':
      return 'free';
    case 'member':
      return 'member';
    case 'constructor':
      return 'constructor';
    case 'index':
      return 'index';
  }

  const hook = provider.classifyCallForm;
  if (hook !== undefined) {
    const scope = scopeTree.getScope(inScopeId);
    if (scope !== undefined) return hook(match, scope);
  }

  return 'free';
}

function extractExplicitReceiver(match: CaptureMatch): { readonly name: string } | undefined {
  const cap = match['@reference.receiver'];
  if (cap === undefined) return undefined;
  return { name: cap.text };
}

function extractArity(match: CaptureMatch): number | undefined {
  const cap = match['@reference.arity'];
  if (cap === undefined) return undefined;
  const n = Number.parseInt(cap.text, 10);
  return Number.isFinite(n) ? n : undefined;
}

function extractArgumentTypes(match: CaptureMatch): readonly string[] | undefined {
  const cap = match['@reference.parameter-types'];
  if (cap === undefined) return undefined;
  try {
    const parsed = JSON.parse(cap.text);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed;
  } catch {
    /* malformed — fall through */
  }
  return undefined;
}
