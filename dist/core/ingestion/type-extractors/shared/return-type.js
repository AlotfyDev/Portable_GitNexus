import { PRIMITIVE_TYPES, WRAPPER_GENERICS, MAX_RETURN_TYPE_INPUT_LENGTH, MAX_RETURN_TYPE_LENGTH, } from './constants.js';
function extractFirstGenericArg(args) {
    let depth = 0;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '<')
            depth++;
        else if (args[i] === '>')
            depth--;
        else if (args[i] === ',' && depth === 0)
            return args.slice(0, i).trim();
    }
    return args.trim();
}
function extractFirstTypeArg(args) {
    let remaining = args;
    while (remaining) {
        const first = extractFirstGenericArg(remaining);
        if (!first.startsWith("'"))
            return first;
        const commaIdx = remaining.indexOf(',', first.length);
        if (commaIdx < 0)
            return first;
        remaining = remaining.slice(commaIdx + 1).trim();
    }
    return args.trim();
}
export const extractReturnTypeName = (raw, depth = 0) => {
    if (depth > 10)
        return undefined;
    if (raw.length > MAX_RETURN_TYPE_INPUT_LENGTH)
        return undefined;
    let text = raw.trim();
    if (!text)
        return undefined;
    text = text.replace(/^[&*]+\s*(mut\s+)?/, '');
    text = text.replace(/\?$/, '');
    if (text.includes('|')) {
        const parts = text
            .split('|')
            .map((p) => p.trim())
            .filter((p) => p !== 'null' && p !== 'undefined' && p !== 'void' && p !== 'None' && p !== 'nil');
        if (parts.length === 1)
            text = parts[0];
        else
            return undefined;
    }
    const genericMatch = text.match(/^(\w+)\s*<(.+)>$/);
    if (genericMatch) {
        const [, base, args] = genericMatch;
        if (WRAPPER_GENERICS.has(base)) {
            const firstArg = extractFirstTypeArg(args);
            return extractReturnTypeName(firstArg, depth + 1);
        }
        return PRIMITIVE_TYPES.has(base.toLowerCase()) ? undefined : base;
    }
    if (WRAPPER_GENERICS.has(text))
        return undefined;
    if (text.includes('::') || text.includes('.') || text.includes('\\')) {
        text = text.split(/::|[.\\]/).pop();
    }
    if (PRIMITIVE_TYPES.has(text) || PRIMITIVE_TYPES.has(text.toLowerCase()))
        return undefined;
    if (!/^[A-Z_]\w*$/.test(text))
        return undefined;
    if (text.length > MAX_RETURN_TYPE_LENGTH)
        return undefined;
    return text;
};
