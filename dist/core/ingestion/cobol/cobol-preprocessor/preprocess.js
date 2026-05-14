export function preprocessCobolSource(content) {
    const firstLines = content.split('\n', 10).join('\n');
    if (/>>SOURCE\s+(?:FORMAT\s+(?:IS\s+)?)?FREE/i.test(firstLines)) {
        return content;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 7)
            continue;
        const seq = line.substring(0, 6);
        if (/\S/.test(seq)) {
            lines[i] = '      ' + line.substring(6);
        }
    }
    return lines.join('\n');
}
