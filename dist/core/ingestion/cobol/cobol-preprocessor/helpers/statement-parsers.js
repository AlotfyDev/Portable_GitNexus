import { MOVE_SKIP } from '../constants.js';
export function extractMoveTargets(afterTo) {
    const text = afterTo.replace(/\..*$/, '').trim();
    if (!text)
        return [];
    const noSubscripts = text.replace(/\([^)]*\)/g, '');
    const tokens = noSubscripts.split(/\s+/).filter((t) => t.length > 0);
    const targets = [];
    const QUAL_KEYWORDS = new Set(['OF', 'IN']);
    let skipNext = false;
    for (const token of tokens) {
        if (skipNext) {
            skipNext = false;
            continue;
        }
        if (QUAL_KEYWORDS.has(token.toUpperCase())) {
            skipNext = true;
            continue;
        }
        if (/^[A-Z][A-Z0-9-]+$/i.test(token) && !MOVE_SKIP.has(token.toUpperCase())) {
            targets.push(token);
        }
    }
    return targets;
}
export function parseDataItemClauses(rest) {
    const result = {};
    const text = rest.replace(/\.\s*$/, '');
    const picMatch = text.match(/\bPIC(?:TURE)?\s+(?:IS\s+)?(\S+)/i);
    if (picMatch) {
        result.pic = picMatch[1];
    }
    const usageMatch = text.match(/\bUSAGE\s+(?:IS\s+)?(COMP(?:UTATIONAL)?(?:-[0-9X])?|BINARY|PACKED-DECIMAL|DISPLAY|INDEX|POINTER|NATIONAL)\b/i);
    if (usageMatch) {
        result.usage = usageMatch[1].toUpperCase();
    }
    else {
        const compMatch = text.match(/\b(COMP(?:UTATIONAL)?(?:-[0-9X])?|BINARY|PACKED-DECIMAL)\b/i);
        if (compMatch) {
            result.usage = compMatch[1].toUpperCase();
        }
    }
    const redefMatch = text.match(/\bREDEFINES\s+([A-Z][A-Z0-9-]+)/i);
    if (redefMatch) {
        result.redefines = redefMatch[1];
    }
    const occursMatch = text.match(/\bOCCURS\s+(\d+)(?:\s+TO\s+(\d+))?\s*(?:TIMES\s*)?(?:DEPENDING\s+ON\s+([A-Z][A-Z0-9-]+(?:\s*\([^)]*\))?))?/i);
    if (occursMatch) {
        result.occurs = parseInt(occursMatch[1], 10);
        if (occursMatch[3]) {
            result.dependingOn = occursMatch[3].replace(/\s*\([^)]*\)/, '').trim();
        }
    }
    result.isExternal = /\bIS\s+EXTERNAL\b/i.test(text) || undefined;
    result.isGlobal = /\bIS\s+GLOBAL\b/i.test(text) || undefined;
    if (!result.value) {
        const valueIdx = text.search(/\bVALUE\b/i);
        if (valueIdx >= 0) {
            const afterValue = text
                .substring(valueIdx + 5)
                .replace(/^\s+IS\s+/i, '')
                .trimStart();
            const quotedMatch = afterValue.match(/^([XNGB])?(?:"([^"]*)"|'([^']*)')/i);
            if (quotedMatch) {
                const prefix = quotedMatch[1] ? quotedMatch[1].toUpperCase() : '';
                result.value = prefix
                    ? `${prefix}'${quotedMatch[2] ?? quotedMatch[3]}'`
                    : (quotedMatch[2] ?? quotedMatch[3]);
            }
            else {
                const allMatch = afterValue.match(/^ALL\s+(?:"([^"]*)"|'([^']*)')/i);
                if (allMatch) {
                    result.value = `ALL '${allMatch[1] ?? allMatch[2]}'`;
                }
                else {
                    const numMatch = afterValue.match(/^(-?\d+\.?\d*)/);
                    if (numMatch) {
                        result.value = numMatch[1];
                    }
                    else {
                        const identMatch = afterValue.match(/^([A-Z][A-Z0-9-]*)/i);
                        if (identMatch)
                            result.value = identMatch[1].toUpperCase();
                    }
                }
            }
        }
    }
    return result;
}
export function parseConditionValues(valuesStr) {
    const text = valuesStr.replace(/\.\s*$/, '').trim();
    const values = [];
    const quotedRe = /(?:"([^"]*)"|'([^']*)')/g;
    let qm;
    let hasQuoted = false;
    while ((qm = quotedRe.exec(text)) !== null) {
        values.push(qm[1] ?? qm[2]);
        hasQuoted = true;
    }
    if (hasQuoted)
        return values;
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
        const upper = token.toUpperCase();
        if (upper === 'THRU' || upper === 'THROUGH') {
            continue;
        }
        if (token.length > 0) {
            values.push(token);
        }
    }
    return values;
}
export function parseSelectStatement(stmt, startLine) {
    const text = stmt.replace(/\s+/g, ' ').trim();
    const nameMatch = text.match(/^SELECT\s+(?:OPTIONAL\s+)?([A-Z][A-Z0-9-]+)/i);
    if (!nameMatch)
        return null;
    const result = {
        selectName: nameMatch[1],
        assignTo: '',
        line: startLine,
    };
    const assignMatch = text.match(/\bASSIGN\s+(?:TO\s+)?("([^"]+)"|([A-Z][A-Z0-9-]*))/i);
    if (assignMatch) {
        result.assignTo = assignMatch[2] || assignMatch[3] || '';
    }
    const orgMatch = text.match(/\bORGANIZATION\s+(?:IS\s+)?(SEQUENTIAL|INDEXED|RELATIVE|LINE\s+SEQUENTIAL)/i);
    if (orgMatch) {
        result.organization = orgMatch[1].toUpperCase();
    }
    const accessMatch = text.match(/\bACCESS\s+(?:MODE\s+)?(?:IS\s+)?(SEQUENTIAL|RANDOM|DYNAMIC)/i);
    if (accessMatch) {
        result.access = accessMatch[1].toUpperCase();
    }
    const keyMatch = text.match(/\bRECORD\s+KEY\s+(?:IS\s+)?([A-Z][A-Z0-9-]+)/i);
    if (keyMatch) {
        result.recordKey = keyMatch[1];
    }
    const altKeyMatches = text.matchAll(/\bALTERNATE\s+RECORD\s+KEY\s+(?:IS\s+)?([A-Z][A-Z0-9-]+)/gi);
    const alternateKeys = [];
    for (const m of altKeyMatches)
        alternateKeys.push(m[1]);
    if (alternateKeys.length > 0)
        result.alternateKeys = alternateKeys;
    const statusMatch = text.match(/\b(?:FILE\s+)?STATUS\s+(?:IS\s+)?([A-Z][A-Z0-9-]+)/i);
    if (statusMatch) {
        result.fileStatus = statusMatch[1];
    }
    result.isOptional = /^SELECT\s+OPTIONAL\b/i.test(text) || undefined;
    return result;
}
