export function stripInlineComment(line) {
    let inQuote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
            if (ch === inQuote)
                inQuote = null;
        }
        else if (ch === '"' || ch === "'") {
            inQuote = ch;
        }
        else if (ch === '|') {
            return line.substring(0, i);
        }
    }
    return line;
}
