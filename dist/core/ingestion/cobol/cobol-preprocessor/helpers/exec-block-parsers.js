export function parseExecSqlBlock(block, line) {
    const body = block
        .replace(/\bEXEC\s+SQL\b/i, '')
        .replace(/\bEND-EXEC\b/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const firstWord = body.split(/\s+/)[0]?.toUpperCase() || '';
    const OP_MAP = {
        SELECT: 'SELECT',
        INSERT: 'INSERT',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        DECLARE: 'DECLARE',
        OPEN: 'OPEN',
        CLOSE: 'CLOSE',
        FETCH: 'FETCH',
        INCLUDE: 'OTHER',
    };
    const operation = OP_MAP[firstWord] || 'OTHER';
    let includeMember;
    if (firstWord === 'INCLUDE') {
        const includeMatch = body.match(/^INCLUDE\s+(?:'([^']+)'|"([^"]+)"|([A-Z][A-Z0-9_-]+))/i);
        if (includeMatch) {
            includeMember = includeMatch[1] ?? includeMatch[2] ?? includeMatch[3];
        }
    }
    const tables = [];
    const tablePatterns = [
        /\bFROM\s+([A-Z][A-Z0-9_]+)/gi,
        /\bINSERT\s+INTO\s+([A-Z][A-Z0-9_]+)/gi,
        /\bUPDATE\s+([A-Z][A-Z0-9_]+)/gi,
        /\bJOIN\s+([A-Z][A-Z0-9_]+)/gi,
    ];
    for (const re of tablePatterns) {
        let m;
        while ((m = re.exec(body)) !== null) {
            const name = m[1].toUpperCase();
            if (!name.startsWith(':') && !tables.includes(name)) {
                tables.push(name);
            }
        }
    }
    const cursors = [];
    const cursorRe = /\bDECLARE\s+([A-Z][A-Z0-9_-]+)\s+CURSOR\b/gi;
    let cm;
    while ((cm = cursorRe.exec(body)) !== null) {
        cursors.push(cm[1]);
    }
    const hostVariables = [];
    const hostRe = /:([A-Z][A-Z0-9-]+)/gi;
    let hm;
    while ((hm = hostRe.exec(body)) !== null) {
        const name = hm[1];
        if (!hostVariables.includes(name)) {
            hostVariables.push(name);
        }
    }
    return { line, tables, cursors, hostVariables, operation, includeMember };
}
export function parseExecCicsBlock(block, line) {
    const body = block
        .replace(/\bEXEC\s+CICS\b/i, '')
        .replace(/\bEND-EXEC\b/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const twoWordCommands = [
        'SEND MAP',
        'RECEIVE MAP',
        'SEND TEXT',
        'SEND CONTROL',
        'READ NEXT',
        'READ PREV',
        'WRITEQ TS',
        'WRITEQ TD',
        'READQ TS',
        'READQ TD',
        'DELETEQ TS',
        'DELETEQ TD',
        'HANDLE ABEND',
        'HANDLE AID',
        'HANDLE CONDITION',
        'START TRANSID',
    ];
    let command = '';
    const upperBody = body.toUpperCase();
    for (const twoWord of twoWordCommands) {
        if (upperBody.startsWith(twoWord)) {
            command = twoWord;
            break;
        }
    }
    if (!command) {
        command = body.split(/\s+/)[0]?.toUpperCase() || '';
    }
    const result = { line, command };
    const mapMatch = body.match(/\bMAP\s*\(\s*(?:['"]([^'"]+)['"]|([A-Z][A-Z0-9-]+))\s*\)/i);
    if (mapMatch)
        result.mapName = mapMatch[1] ?? mapMatch[2];
    const progMatch = body.match(/\bPROGRAM\s*\(\s*(?:['"]([^'"]+)['"]|([A-Z][A-Z0-9-]+))\s*\)/i);
    if (progMatch) {
        result.programName = progMatch[1] ?? progMatch[2];
        result.programIsLiteral = !!progMatch[1];
    }
    const transMatch = body.match(/\bTRANSID\s*\(\s*(?:['"]([^'"]+)['"]|([A-Z][A-Z0-9-]+))\s*\)/i);
    if (transMatch)
        result.transId = transMatch[1] ?? transMatch[2];
    const fileMatch = body.match(/\b(?:FILE|DATASET)\s*\(\s*(?:['"]([^'"]+)['"]|([A-Z][A-Z0-9-]+))\s*\)/i);
    if (fileMatch) {
        result.fileName = fileMatch[1] ?? fileMatch[2];
        result.fileIsLiteral = !!fileMatch[1];
    }
    const queueMatch = body.match(/\bQUEUE\s*\(\s*(?:['"]([^'"]+)['"]|([A-Z][A-Z0-9-]+))\s*\)/i);
    if (queueMatch)
        result.queueName = queueMatch[1] ?? queueMatch[2];
    const labelMatch = body.match(/\bLABEL\s*\(\s*([A-Z][A-Z0-9-]+)\s*\)/i);
    if (labelMatch)
        result.labelName = labelMatch[1];
    const intoMatch = body.match(/\bINTO\s*\(\s*([A-Z][A-Z0-9-]+)\s*\)/i);
    if (intoMatch)
        result.intoField = intoMatch[1];
    const fromMatch = body.match(/\bFROM\s*\(\s*([A-Z][A-Z0-9-]+)\s*\)/i);
    if (fromMatch)
        result.fromField = fromMatch[1];
    return result;
}
export function parseExecDliBlock(block, line) {
    const body = block
        .replace(/\bEXEC\s+DLI\b/i, '')
        .replace(/\bEND-EXEC\b/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const verb = body.split(/\s+/)[0]?.toUpperCase() || '';
    const result = { line, verb };
    const pcbMatch = body.match(/\bUSING\s+PCB\s*\(\s*(\d+)\s*\)/i);
    if (pcbMatch)
        result.pcbNumber = parseInt(pcbMatch[1], 10);
    const segMatch = body.match(/\bSEGMENT\s*\(\s*([A-Z][A-Z0-9-]*)\s*\)/i);
    if (segMatch)
        result.segmentName = segMatch[1];
    const intoMatch = body.match(/\bINTO\s*\(\s*([A-Z][A-Z0-9-]+)\s*\)/i);
    if (intoMatch)
        result.intoField = intoMatch[1];
    const fromMatch = body.match(/\bFROM\s*\(\s*([A-Z][A-Z0-9-]+)\s*\)/i);
    if (fromMatch)
        result.fromField = fromMatch[1];
    const psbMatch = body.match(/\bPSB\s*\(\s*([A-Z][A-Z0-9-]+)\s*\)/i);
    if (psbMatch)
        result.psbName = psbMatch[1];
    return result;
}
