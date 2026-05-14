import { anchorCaptureFor, rangesEqual } from './capture-utils.js';
import { draftToScope } from './scope-builder.js';
export function pass2AttachDeclarations(matches, drafts, positionIndex, localDefs, filePath, provider, scopeTree) {
    const draftById = new Map();
    for (const d of drafts)
        draftById.set(d.id, d);
    for (const match of matches) {
        const anchor = anchorCaptureFor(match, '@declaration.');
        if (anchor === undefined)
            continue;
        const def = buildDefFromDeclarationMatch(match, anchor, filePath);
        if (def === undefined)
            continue;
        const innermostId = positionIndex.atPosition(filePath, anchor.range.startLine, anchor.range.startCol);
        if (innermostId === undefined)
            continue;
        const innermost = draftById.get(innermostId);
        if (innermost === undefined)
            continue;
        innermost.ownedDefs.push(def);
        localDefs.push(def);
        const autoHostedId = innermost.parent !== null && rangesEqual(anchor.range, innermost.range)
            ? innermost.parent
            : innermost.id;
        const bindingScopeId = provider.bindingScopeFor?.(match, draftToScope(innermost), scopeTree) ?? autoHostedId;
        const bindingHost = draftById.get(bindingScopeId) ?? innermost;
        const nameKey = deriveDeclarationName(match, def);
        if (nameKey === undefined)
            continue;
        const existing = bindingHost.bindings.get(nameKey) ?? [];
        existing.push({ def, origin: 'local' });
        bindingHost.bindings.set(nameKey, existing);
    }
}
function buildDefFromDeclarationMatch(match, anchor, filePath) {
    const kindStr = anchor.name.slice('@declaration.'.length);
    const type = normalizeNodeLabel(kindStr);
    if (type === undefined)
        return undefined;
    const nameCap = match['@declaration.name'] ?? match[`@declaration.${kindStr}.name`] ?? match[anchor.name];
    if (nameCap === undefined)
        return undefined;
    const qualifiedCap = match['@declaration.qualified_name'];
    const qualifiedName = qualifiedCap?.text;
    const parameterCount = parseIntCapture(match['@declaration.parameter-count']);
    const requiredParameterCount = parseIntCapture(match['@declaration.required-parameter-count']);
    const parameterTypes = parseJsonStringArrayCapture(match['@declaration.parameter-types']);
    const declaredType = match['@declaration.field-type']?.text;
    const returnType = match['@declaration.return-type']?.text;
    return {
        nodeId: makeDefId(filePath, anchor.range, type, nameCap.text),
        filePath,
        type,
        ...(qualifiedName !== undefined ? { qualifiedName } : { qualifiedName: nameCap.text }),
        ...(parameterCount !== undefined ? { parameterCount } : {}),
        ...(requiredParameterCount !== undefined ? { requiredParameterCount } : {}),
        ...(parameterTypes !== undefined ? { parameterTypes } : {}),
        ...(declaredType !== undefined ? { declaredType } : {}),
        ...(returnType !== undefined ? { returnType } : {}),
    };
}
function parseIntCapture(cap) {
    if (cap === undefined)
        return undefined;
    const n = Number.parseInt(cap.text, 10);
    return Number.isFinite(n) ? n : undefined;
}
function parseJsonStringArrayCapture(cap) {
    if (cap === undefined)
        return undefined;
    try {
        const parsed = JSON.parse(cap.text);
        if (!Array.isArray(parsed))
            return undefined;
        return parsed.every((x) => typeof x === 'string') ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function deriveDeclarationName(match, def) {
    const nameCap = match['@declaration.name'] ??
        match[Object.keys(match).find((k) => k.startsWith('@declaration.') && k.endsWith('.name')) ?? ''];
    if (nameCap !== undefined)
        return nameCap.text;
    const q = def.qualifiedName;
    if (q !== undefined && q.length > 0) {
        const dot = q.lastIndexOf('.');
        return dot === -1 ? q : q.slice(dot + 1);
    }
    return undefined;
}
function normalizeNodeLabel(kindStr) {
    switch (kindStr.toLowerCase()) {
        case 'class':
            return 'Class';
        case 'interface':
            return 'Interface';
        case 'enum':
            return 'Enum';
        case 'struct':
            return 'Struct';
        case 'union':
            return 'Union';
        case 'trait':
            return 'Trait';
        case 'method':
            return 'Method';
        case 'function':
            return 'Function';
        case 'constructor':
            return 'Constructor';
        case 'field':
        case 'property':
            return 'Property';
        case 'variable':
        case 'const':
            return 'Variable';
        case 'typealias':
        case 'type_alias':
            return 'TypeAlias';
        case 'typedef':
            return 'Typedef';
        case 'record':
            return 'Record';
        case 'delegate':
            return 'Delegate';
        case 'annotation':
            return 'Annotation';
        case 'namespace':
            return 'Namespace';
        default:
            return undefined;
    }
}
function makeDefId(filePath, range, type, name) {
    return `def:${filePath}#${range.startLine}:${range.startCol}:${type}:${name}`;
}
