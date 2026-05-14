export function rangesEqual(a, b) {
    return (a.startLine === b.startLine &&
        a.startCol === b.startCol &&
        a.endLine === b.endLine &&
        a.endCol === b.endCol);
}
const KNOWN_SUB_TAGS = new Set([
    '@declaration.name',
    '@declaration.qualified_name',
    '@import.name',
    '@import.source',
    '@import.alias',
    '@type-binding.name',
    '@type-binding.type',
    '@reference.name',
    '@reference.receiver',
    '@reference.arity',
    '@reference.parameter-types',
    '@declaration.parameter-count',
    '@declaration.required-parameter-count',
    '@declaration.parameter-types',
]);
export function anchorCaptureFor(match, prefix) {
    let best;
    let bestSpan = -1;
    for (const name of Object.keys(match)) {
        if (!name.startsWith(prefix))
            continue;
        if (KNOWN_SUB_TAGS.has(name))
            continue;
        const cap = match[name];
        const span = (cap.range.endLine - cap.range.startLine) * 1_000_000 +
            (cap.range.endCol - cap.range.startCol);
        if (span > bestSpan) {
            bestSpan = span;
            best = cap;
        }
    }
    return best;
}
