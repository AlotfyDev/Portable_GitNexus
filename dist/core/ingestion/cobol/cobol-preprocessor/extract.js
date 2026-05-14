import { RE_PROGRAM_ID, RE_END_PROGRAM, RE_DIVISION, RE_SECTION, RE_AUTHOR, RE_DATE_WRITTEN, RE_DATE_COMPILED, RE_INSTALLATION, RE_FD, RE_DATA_ITEM, RE_88_LEVEL, RE_66_LEVEL, RE_ANONYMOUS_REDEFINES, RE_PROC_SECTION, RE_PROC_PARAGRAPH, RE_PERFORM, RE_CALL, RE_CALL_DYNAMIC, RE_COPY_UNQUOTED, RE_COPY_QUOTED, RE_EXEC_SQL_START, RE_EXEC_CICS_START, RE_EXEC_DLI_START, RE_END_EXEC, RE_SELECT_START, RE_SORT, RE_MERGE, RE_SEARCH, RE_CANCEL, RE_CANCEL_DYNAMIC, RE_GOTO, RE_MOVE, RE_ENTRY, RE_PROC_USING, RE_DECLARATIVES_START, RE_DECLARATIVES_END, RE_USE_AFTER, RE_SET_TO_TRUE, RE_SET_INDEX, RE_INITIALIZE, RE_STATEMENT_VERB_START, RE_USING_PARAMS, USING_KEYWORDS, CALL_USING_FILTER, EXCLUDED_PARA_NAMES, SORT_CLAUSE_NOISE, MOVE_SKIP, PERFORM_KEYWORD_SKIP, INITIALIZE_CLAUSE_KEYWORDS, } from './constants.js';
import { stripInlineComment } from './helpers/string-utils.js';
import { parseDataItemClauses, parseConditionValues, extractMoveTargets, parseSelectStatement } from './helpers/statement-parsers.js';
import { parseExecSqlBlock, parseExecCicsBlock, parseExecDliBlock } from './helpers/exec-block-parsers.js';
export function extractCobolSymbolsWithRegex(content, _filePath) {
    const rawLines = content.split(/\r?\n/);
    const result = {
        programName: null,
        programs: [],
        paragraphs: [],
        sections: [],
        performs: [],
        calls: [],
        copies: [],
        dataItems: [],
        fileDeclarations: [],
        fdEntries: [],
        programMetadata: {},
        execSqlBlocks: [],
        execCicsBlocks: [],
        procedureUsing: [],
        entryPoints: [],
        moves: [],
        gotos: [],
        sorts: [],
        searches: [],
        cancels: [],
        execDliBlocks: [],
        declaratives: [],
        sets: [],
        inspects: [],
        initializes: [],
    };
    let currentDivision = null;
    let currentDataSection = 'unknown';
    let currentEnvSection = null;
    let currentParagraph = null;
    const programBoundaryStack = [];
    let selectAccum = null;
    let selectStartLine = 0;
    let pendingProcUsing = false;
    let sortAccum = null;
    let sortStartLine = 0;
    let execAccum = null;
    let inDeclaratives = false;
    let inspectAccum = null;
    let inspectStartLine = 0;
    let callAccum = null;
    let callAccumLine = 0;
    let pendingFdName = null;
    let pendingFdLine = 0;
    let pendingLine = null;
    let pendingLineNumber = 0;
    let isFreeFormat = false;
    for (let i = 0; i < Math.min(rawLines.length, 10); i++) {
        if (/>>SOURCE\s+(?:FORMAT\s+(?:IS\s+)?)?FREE/i.test(rawLines[i])) {
            isFreeFormat = true;
            break;
        }
    }
    for (let i = 0; i < rawLines.length; i++) {
        const raw = rawLines[i];
        if (isFreeFormat) {
            if (/^[ \t]*>>/.test(raw))
                continue;
            const trimmed = raw.trimStart();
            if (trimmed.startsWith('*>') || trimmed.length === 0)
                continue;
            let commentIdx = -1;
            let ffInQuote = null;
            for (let ci = 0; ci < raw.length - 1; ci++) {
                const c = raw[ci];
                if (ffInQuote) {
                    if (c === ffInQuote)
                        ffInQuote = null;
                }
                else if (c === '"' || c === "'") {
                    ffInQuote = c;
                }
                else if (c === '*' && raw[ci + 1] === '>') {
                    commentIdx = ci;
                    break;
                }
            }
            const line = commentIdx >= 0 ? raw.substring(0, commentIdx) : raw;
            const lineNum = i + 1;
            processLogicalLine(line.trim(), lineNum);
            continue;
        }
        if (raw.length < 7) {
            if (pendingLine !== null) {
                processLogicalLine(pendingLine, pendingLineNumber);
                pendingLine = null;
            }
            continue;
        }
        const indicator = raw[6];
        if (indicator === '*' || indicator === '/') {
            continue;
        }
        if (indicator === '-') {
            if (pendingLine !== null) {
                const continuation = raw.substring(7).trimStart();
                if (continuation.length > 0 && (continuation[0] === '"' || continuation[0] === "'")) {
                    const quoteChar = continuation[0];
                    const lastQuoteIdx = pendingLine.lastIndexOf(quoteChar);
                    if (lastQuoteIdx >= 0) {
                        pendingLine = pendingLine.substring(0, lastQuoteIdx) + continuation.substring(1);
                    }
                    else {
                        pendingLine += continuation;
                    }
                }
                else {
                    pendingLine += continuation;
                }
            }
            continue;
        }
        if (pendingLine !== null) {
            processLogicalLine(pendingLine, pendingLineNumber);
            pendingLine = null;
        }
        const cleaned = stripInlineComment(raw);
        pendingLine = cleaned;
        pendingLineNumber = i + 1;
    }
    if (pendingLine !== null) {
        processLogicalLine(pendingLine, pendingLineNumber);
    }
    flushSelect();
    flushSort();
    flushInspect();
    flushCallAccum();
    if (execAccum !== null) {
        if (execAccum.type === 'sql') {
            result.execSqlBlocks.push(parseExecSqlBlock(execAccum.lines, execAccum.startLine));
        }
        else if (execAccum.type === 'cics') {
            result.execCicsBlocks.push(parseExecCicsBlock(execAccum.lines, execAccum.startLine));
        }
        else if (execAccum.type === 'dli') {
            result.execDliBlocks.push(parseExecDliBlock(execAccum.lines, execAccum.startLine));
        }
        execAccum = null;
    }
    if (pendingFdName !== null) {
        result.fdEntries.push({ fdName: pendingFdName, line: pendingFdLine });
        pendingFdName = null;
    }
    while (programBoundaryStack.length > 0) {
        const topProgram = programBoundaryStack.pop();
        result.programs.push({
            name: topProgram.name,
            startLine: topProgram.startLine,
            endLine: rawLines.length,
            nestingDepth: programBoundaryStack.length,
            procedureUsing: topProgram.procedureUsing,
            isCommon: topProgram.isCommon,
        });
    }
    if (result.programs.length > 1) {
        result.programs.sort((a, b) => a.startLine - b.startLine);
    }
    return result;
    // =========================================================================
    // Inner function: process one logical line
    // =========================================================================
    function processLogicalLine(line, lineNum) {
        if (execAccum !== null) {
            execAccum.lines += ' ' + line;
            if (RE_END_EXEC.test(line)) {
                if (execAccum.type === 'sql') {
                    result.execSqlBlocks.push(parseExecSqlBlock(execAccum.lines, execAccum.startLine));
                }
                else if (execAccum.type === 'cics') {
                    result.execCicsBlocks.push(parseExecCicsBlock(execAccum.lines, execAccum.startLine));
                }
                else if (execAccum.type === 'dli') {
                    result.execDliBlocks.push(parseExecDliBlock(execAccum.lines, execAccum.startLine));
                }
                execAccum = null;
            }
            return;
        }
        if (RE_EXEC_SQL_START.test(line)) {
            flushCallAccum();
            execAccum = { type: 'sql', lines: line, startLine: lineNum };
            if (RE_END_EXEC.test(line)) {
                result.execSqlBlocks.push(parseExecSqlBlock(execAccum.lines, execAccum.startLine));
                execAccum = null;
            }
            return;
        }
        if (RE_EXEC_CICS_START.test(line)) {
            flushCallAccum();
            execAccum = { type: 'cics', lines: line, startLine: lineNum };
            if (RE_END_EXEC.test(line)) {
                result.execCicsBlocks.push(parseExecCicsBlock(execAccum.lines, execAccum.startLine));
                execAccum = null;
            }
            return;
        }
        if (RE_EXEC_DLI_START.test(line)) {
            flushCallAccum();
            execAccum = { type: 'dli', lines: line, startLine: lineNum };
            if (RE_END_EXEC.test(line)) {
                result.execDliBlocks.push(parseExecDliBlock(execAccum.lines, execAccum.startLine));
                execAccum = null;
            }
            return;
        }
        const endProgramMatch = line.match(RE_END_PROGRAM);
        if (endProgramMatch) {
            flushCallAccum();
            flushSort();
            flushInspect();
            const topProgram = programBoundaryStack.pop();
            if (topProgram) {
                result.programs.push({
                    name: topProgram.name,
                    startLine: topProgram.startLine,
                    endLine: lineNum,
                    nestingDepth: programBoundaryStack.length,
                    procedureUsing: topProgram.procedureUsing,
                    isCommon: topProgram.isCommon,
                });
            }
            return;
        }
        if (RE_DECLARATIVES_START.test(line)) {
            inDeclaratives = true;
            return;
        }
        if (RE_DECLARATIVES_END.test(line)) {
            inDeclaratives = false;
            return;
        }
        if (currentDivision !== 'identification') {
            const pgmIdMatch = line.match(RE_PROGRAM_ID);
            if (pgmIdMatch) {
                flushCallAccum();
                flushSort();
                flushInspect();
                extractIdentification(line, lineNum);
                return;
            }
        }
        const divMatch = line.match(RE_DIVISION);
        if (divMatch) {
            flushSelect();
            flushCallAccum();
            flushSort();
            flushInspect();
            const divName = divMatch[1].toUpperCase();
            switch (divName) {
                case 'IDENTIFICATION':
                    currentDivision = 'identification';
                    break;
                case 'ENVIRONMENT':
                    currentDivision = 'environment';
                    currentEnvSection = null;
                    break;
                case 'DATA':
                    currentDivision = 'data';
                    currentDataSection = 'unknown';
                    break;
                case 'PROCEDURE': {
                    currentDivision = 'procedure';
                    currentParagraph = null;
                    const procUsingMatch = line.match(RE_PROC_USING);
                    if (procUsingMatch) {
                        const params = procUsingMatch[1]
                            .split(/\bRETURNING\b/i)[0]
                            .trim()
                            .split(/\s+/)
                            .filter((s) => s.length > 0 && !USING_KEYWORDS.has(s.toUpperCase()));
                        result.procedureUsing = params;
                        const topProg = programBoundaryStack[programBoundaryStack.length - 1];
                        if (topProg)
                            topProg.procedureUsing = params;
                        pendingProcUsing = false;
                    }
                    else {
                        pendingProcUsing = !/\.\s*$/.test(line);
                    }
                    break;
                }
            }
            return;
        }
        const secMatch = line.match(RE_SECTION);
        if (secMatch) {
            flushSelect();
            const secName = secMatch[1].toUpperCase();
            switch (secName) {
                case 'WORKING-STORAGE':
                    currentDivision = 'data';
                    currentDataSection = 'working-storage';
                    break;
                case 'LINKAGE':
                    currentDivision = 'data';
                    currentDataSection = 'linkage';
                    break;
                case 'FILE':
                    currentDivision = 'data';
                    currentDataSection = 'file';
                    break;
                case 'LOCAL-STORAGE':
                    currentDivision = 'data';
                    currentDataSection = 'local-storage';
                    break;
                case 'SCREEN':
                    currentDivision = 'data';
                    currentDataSection = 'screen';
                    break;
                case 'INPUT-OUTPUT':
                    currentDivision = 'environment';
                    currentEnvSection = 'input-output';
                    break;
                case 'CONFIGURATION':
                    currentDivision = 'environment';
                    currentEnvSection = 'configuration';
                    break;
            }
            return;
        }
        const copyQMatch = line.match(RE_COPY_QUOTED);
        if (copyQMatch) {
            result.copies.push({ target: copyQMatch[1] ?? copyQMatch[2], line: lineNum });
        }
        else {
            const copyUMatch = line.match(RE_COPY_UNQUOTED);
            if (copyUMatch) {
                result.copies.push({ target: copyUMatch[1], line: lineNum });
            }
        }
        if (callAccum !== null) {
            const trimmedLine = line.trimStart();
            const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
            const isAreaAParagraph = RE_PROC_PARAGRAPH.test(line) && (!isFreeFormat ? leadingSpaces <= 7 : false);
            if (RE_STATEMENT_VERB_START.test(trimmedLine) ||
                RE_PROC_SECTION.test(line) ||
                isAreaAParagraph) {
                flushCallAccum();
            }
            else {
                callAccum += ' ' + line;
                if (/\.\s*$/.test(callAccum) || /\bEND-CALL\b/i.test(callAccum)) {
                    flushCallAccum();
                }
                return;
            }
        }
        else if (currentDivision === 'procedure' &&
            /(?<![A-Z0-9-])\bCALL\s+(?:"[^"]+"|'[^']+'|[A-Z][A-Z0-9-]+)/i.test(line)) {
            if (/\.\s*$/.test(line) || /\bEND-CALL\b/i.test(line)) {
                callAccum = line;
                callAccumLine = lineNum;
                flushCallAccum();
            }
            else {
                callAccum = line;
                callAccumLine = lineNum;
                return;
            }
        }
        switch (currentDivision) {
            case 'identification':
                extractIdentification(line, lineNum);
                break;
            case 'environment':
                extractEnvironment(line, lineNum);
                break;
            case 'data':
                extractData(line, lineNum);
                break;
            case 'procedure':
                extractProcedure(line, lineNum);
                break;
        }
    }
    // =========================================================================
    // IDENTIFICATION DIVISION extraction
    // =========================================================================
    function extractIdentification(line, lineNum) {
        const m = line.match(RE_PROGRAM_ID);
        if (m) {
            if (result.programName === null) {
                result.programName = m[1];
            }
            currentDivision = 'identification';
            currentDataSection = 'unknown';
            currentEnvSection = null;
            currentParagraph = null;
            const isCommon = /\bIS\s+COMMON\b/i.test(line);
            programBoundaryStack.push({
                name: m[1],
                startLine: lineNum,
                isCommon: isCommon || undefined,
            });
            return;
        }
        const authorMatch = line.match(RE_AUTHOR);
        if (authorMatch) {
            result.programMetadata.author = authorMatch[1].replace(/\.\s*$/, '').trim();
            return;
        }
        const dateMatch = line.match(RE_DATE_WRITTEN);
        if (dateMatch) {
            result.programMetadata.dateWritten = dateMatch[1].replace(/\.\s*$/, '').trim();
            return;
        }
        const compMatch = line.match(RE_DATE_COMPILED);
        if (compMatch) {
            result.programMetadata.dateCompiled = compMatch[1].replace(/\.\s*$/, '').trim();
            return;
        }
        const instMatch = line.match(RE_INSTALLATION);
        if (instMatch) {
            result.programMetadata.installation = instMatch[1].replace(/\.\s*$/, '').trim();
        }
    }
    // =========================================================================
    // ENVIRONMENT DIVISION extraction
    // =========================================================================
    function extractEnvironment(line, lineNum) {
        if (currentEnvSection !== 'input-output')
            return;
        const selMatch = line.match(RE_SELECT_START);
        if (selMatch) {
            flushSelect();
            selectAccum = line.trim();
            selectStartLine = lineNum;
        }
        else if (selectAccum !== null) {
            selectAccum += ' ' + line.trim();
        }
        if (selectAccum !== null && /\.\s*$/.test(selectAccum)) {
            flushSelect();
        }
    }
    function flushSelect() {
        if (selectAccum === null)
            return;
        const decl = parseSelectStatement(selectAccum, selectStartLine);
        if (decl) {
            result.fileDeclarations.push(decl);
        }
        selectAccum = null;
    }
    function flushSort() {
        if (sortAccum === null)
            return;
        const fullSort = sortAccum;
        const smatch = fullSort.match(RE_SORT) || fullSort.match(RE_MERGE);
        if (smatch) {
            const upper = fullSort.toUpperCase();
            const usingIdx = upper.search(/\bUSING\s/);
            const givingIdx = upper.search(/\bGIVING\s/);
            const usingFiles = [];
            const givingFiles = [];
            if (usingIdx >= 0) {
                const afterUsing = fullSort.substring(usingIdx + 6);
                const gIdx = afterUsing.toUpperCase().search(/\bGIVING\b/);
                const usingText = gIdx >= 0 ? afterUsing.substring(0, gIdx) : afterUsing;
                usingFiles.push(...usingText
                    .trim()
                    .split(/\s+/)
                    .map((f) => f.replace(/\.$/, ''))
                    .filter((f) => /^[A-Z][A-Z0-9-]+$/i.test(f) && !SORT_CLAUSE_NOISE.has(f.toUpperCase())));
            }
            if (givingIdx >= 0) {
                const givingText = fullSort.substring(givingIdx + 7);
                givingFiles.push(...givingText
                    .trim()
                    .split(/\s+/)
                    .map((f) => f.replace(/\.$/, ''))
                    .filter((f) => /^[A-Z][A-Z0-9-]+$/i.test(f) && !SORT_CLAUSE_NOISE.has(f.toUpperCase())));
            }
            const inputProcMatch = fullSort.match(/\bINPUT\s+PROCEDURE\s+(?:IS\s+)?([A-Z][A-Z0-9-]+)(?:\s+(?:THRU|THROUGH)\s+([A-Z][A-Z0-9-]+))?/i);
            const outputProcMatch = fullSort.match(/\bOUTPUT\s+PROCEDURE\s+(?:IS\s+)?([A-Z][A-Z0-9-]+)(?:\s+(?:THRU|THROUGH)\s+([A-Z][A-Z0-9-]+))?/i);
            if (inputProcMatch) {
                result.performs.push({
                    caller: currentParagraph,
                    target: inputProcMatch[1],
                    thruTarget: inputProcMatch[2] || undefined,
                    line: sortStartLine,
                });
            }
            if (outputProcMatch) {
                result.performs.push({
                    caller: currentParagraph,
                    target: outputProcMatch[1],
                    thruTarget: outputProcMatch[2] || undefined,
                    line: sortStartLine,
                });
            }
            result.sorts.push({ sortFile: smatch[1], usingFiles, givingFiles, line: sortStartLine });
        }
        sortAccum = null;
    }
    function flushInspect() {
        if (inspectAccum === null)
            return;
        const text = inspectAccum;
        const fieldMatch = text.match(/\bINSPECT\s+([A-Z][A-Z0-9-]+)/i);
        if (!fieldMatch) {
            inspectAccum = null;
            return;
        }
        const counters = [];
        const tallySection = text.match(/\bTALLYING\b([\s\S]+?)(?:\bREPLACING\b|\bCONVERTING\b|\.\s*$)/i);
        if (tallySection) {
            const counterRe = /([A-Z][A-Z0-9-]+)\s+FOR\b/gi;
            let cm;
            while ((cm = counterRe.exec(tallySection[1])) !== null) {
                counters.push(cm[1]);
            }
        }
        const hasTallying = /\bTALLYING\b/i.test(text);
        const hasReplacing = /\bREPLACING\b/i.test(text);
        const hasConverting = /\bCONVERTING\b/i.test(text);
        const form = hasConverting
            ? 'converting'
            : hasTallying && hasReplacing
                ? 'tallying-replacing'
                : hasTallying
                    ? 'tallying'
                    : 'replacing';
        result.inspects.push({
            inspectedField: fieldMatch[1],
            counters,
            form,
            line: inspectStartLine,
            caller: currentParagraph,
        });
        inspectAccum = null;
    }
    function flushCallAccum() {
        if (callAccum === null)
            return;
        const text = callAccum;
        for (const callMatch of text.matchAll(RE_CALL)) {
            const callTarget = callMatch[1] ?? callMatch[2];
            const afterCall = text.substring(callMatch.index + callMatch[0].length);
            const usingMatch = afterCall.match(RE_USING_PARAMS);
            const parameters = usingMatch
                ? usingMatch[1]
                    .split(/\bRETURNING\b/i)[0]
                    .trim()
                    .split(/\s+/)
                    .filter((s) => s.length > 0 &&
                    !CALL_USING_FILTER.has(s.toUpperCase()) &&
                    /^[A-Z][A-Z0-9-]+$/i.test(s))
                : undefined;
            const retMatch = afterCall.match(/\bRETURNING\s+([A-Z][A-Z0-9-]+)/i);
            const returning = retMatch ? retMatch[1] : undefined;
            result.calls.push({
                target: callTarget,
                line: callAccumLine,
                isQuoted: true,
                parameters,
                returning,
            });
        }
        for (const dynCallMatch of text.matchAll(RE_CALL_DYNAMIC)) {
            const afterDynCall = text.substring(dynCallMatch.index + dynCallMatch[0].length);
            const dynUsingMatch = afterDynCall.match(RE_USING_PARAMS);
            const dynParameters = dynUsingMatch
                ? dynUsingMatch[1]
                    .split(/\bRETURNING\b/i)[0]
                    .trim()
                    .split(/\s+/)
                    .filter((s) => s.length > 0 &&
                    !CALL_USING_FILTER.has(s.toUpperCase()) &&
                    /^[A-Z][A-Z0-9-]+$/i.test(s))
                : undefined;
            const dynRetMatch = afterDynCall.match(/\bRETURNING\s+([A-Z][A-Z0-9-]+)/i);
            const dynReturning = dynRetMatch ? dynRetMatch[1] : undefined;
            result.calls.push({
                target: dynCallMatch[1],
                line: callAccumLine,
                isQuoted: false,
                parameters: dynParameters,
                returning: dynReturning,
            });
        }
        for (const cancelMatch of text.matchAll(RE_CANCEL)) {
            result.cancels.push({
                target: cancelMatch[1] ?? cancelMatch[2],
                line: callAccumLine,
                isQuoted: true,
            });
        }
        for (const dynCancelMatch of text.matchAll(RE_CANCEL_DYNAMIC)) {
            result.cancels.push({ target: dynCancelMatch[1], line: callAccumLine, isQuoted: false });
        }
        callAccum = null;
    }
    // =========================================================================
    // DATA DIVISION extraction
    // =========================================================================
    function extractData(line, lineNum) {
        const fdMatch = line.match(RE_FD);
        if (fdMatch) {
            if (pendingFdName !== null) {
                result.fdEntries.push({ fdName: pendingFdName, line: pendingFdLine });
            }
            pendingFdName = fdMatch[1];
            pendingFdLine = lineNum;
            return;
        }
        const lv88Match = line.match(RE_88_LEVEL);
        if (lv88Match) {
            const name = lv88Match[1];
            const values = parseConditionValues(lv88Match[2]);
            result.dataItems.push({
                name,
                level: 88,
                line: lineNum,
                values,
                section: currentDataSection,
            });
            return;
        }
        const lv66Match = line.match(RE_66_LEVEL);
        if (lv66Match) {
            result.dataItems.push({
                name: lv66Match[1],
                level: 66,
                line: lineNum,
                redefines: lv66Match[2],
                section: currentDataSection,
            });
            return;
        }
        const anonRedefMatch = line.match(RE_ANONYMOUS_REDEFINES);
        if (anonRedefMatch) {
            const level = parseInt(anonRedefMatch[1], 10);
            const dataMatch = line.match(RE_DATA_ITEM);
            if (!dataMatch || dataMatch[2].toUpperCase() === 'REDEFINES') {
                return;
            }
        }
        const dataMatch = line.match(RE_DATA_ITEM);
        if (dataMatch) {
            const level = parseInt(dataMatch[1], 10);
            const name = dataMatch[2];
            const rest = dataMatch[3] || '';
            if (name.toUpperCase() === 'FILLER')
                return;
            if ((level >= 1 && level <= 49) || level === 66 || level === 77) {
                const clauses = parseDataItemClauses(rest);
                const item = {
                    name,
                    level,
                    line: lineNum,
                    section: currentDataSection,
                };
                if (clauses.pic)
                    item.pic = clauses.pic;
                if (clauses.usage)
                    item.usage = clauses.usage;
                if (clauses.occurs !== undefined)
                    item.occurs = clauses.occurs;
                if (clauses.dependingOn)
                    item.dependingOn = clauses.dependingOn;
                if (clauses.redefines)
                    item.redefines = clauses.redefines;
                if (clauses.value)
                    item.values = [clauses.value];
                if (clauses.isExternal)
                    item.isExternal = true;
                if (clauses.isGlobal)
                    item.isGlobal = true;
                result.dataItems.push(item);
                if (pendingFdName !== null && level === 1) {
                    result.fdEntries.push({
                        fdName: pendingFdName,
                        recordName: name,
                        line: pendingFdLine,
                    });
                    pendingFdName = null;
                }
            }
        }
    }
    // =========================================================================
    // PROCEDURE DIVISION extraction
    // =========================================================================
    function extractProcedure(line, lineNum) {
        if (inDeclaratives) {
            const useMatch = line.match(RE_USE_AFTER);
            if (useMatch) {
                const lastSection = result.sections[result.sections.length - 1];
                if (lastSection) {
                    result.declaratives.push({
                        sectionName: lastSection.name,
                        target: useMatch[1],
                        line: lineNum,
                    });
                }
                return;
            }
        }
        if (pendingProcUsing) {
            const usingMatch = line.match(/\bUSING\s+([\s\S]*?)(?:\.|$)/i);
            if (usingMatch) {
                const params = usingMatch[1]
                    .split(/\bRETURNING\b/i)[0]
                    .trim()
                    .split(/\s+/)
                    .filter((s) => s.length > 0 && !USING_KEYWORDS.has(s.toUpperCase()));
                result.procedureUsing = params;
                const topProg = programBoundaryStack[programBoundaryStack.length - 1];
                if (topProg)
                    topProg.procedureUsing = params;
            }
            pendingProcUsing = false;
            if (usingMatch)
                return;
        }
        const secMatch = line.match(RE_PROC_SECTION);
        if (secMatch) {
            const name = secMatch[1];
            if (!EXCLUDED_PARA_NAMES.has(name.toUpperCase()) &&
                !name.toUpperCase().includes('DIVISION')) {
                result.sections.push({ name, line: lineNum });
            }
            return;
        }
        const paraMatch = line.match(RE_PROC_PARAGRAPH);
        if (paraMatch) {
            const name = paraMatch[1];
            const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
            if (!isFreeFormat && leadingSpaces > 7)
                return;
            if (!EXCLUDED_PARA_NAMES.has(name.toUpperCase()) &&
                !name.toUpperCase().startsWith('END-') &&
                name.toUpperCase() !== 'DIVISION' &&
                name.toUpperCase() !== 'SECTION') {
                result.paragraphs.push({ name, line: lineNum });
                currentParagraph = name;
            }
            return;
        }
        for (const perfMatch of line.matchAll(RE_PERFORM)) {
            const target = perfMatch[1];
            if (!PERFORM_KEYWORD_SKIP.has(target.toUpperCase())) {
                const matchEnd = perfMatch.index + perfMatch[0].length;
                const afterTarget = line.substring(matchEnd).trim();
                if (!/^TIMES\b/i.test(afterTarget)) {
                    result.performs.push({
                        caller: currentParagraph,
                        target,
                        thruTarget: perfMatch[2] || undefined,
                        line: lineNum,
                    });
                }
            }
        }
        const entryMatch = line.match(RE_ENTRY);
        if (entryMatch) {
            const entryName = entryMatch[1] ?? entryMatch[2];
            const usingClause = entryMatch[3];
            if (entryName) {
                result.entryPoints.push({
                    name: entryName,
                    parameters: usingClause
                        ? usingClause
                            .trim()
                            .split(/\s+/)
                            .filter((s) => s.length > 0 && !USING_KEYWORDS.has(s.toUpperCase()))
                        : [],
                    line: lineNum,
                });
            }
        }
        const moveMatch = line.match(RE_MOVE);
        if (moveMatch) {
            const from = moveMatch[2].toUpperCase();
            if (!MOVE_SKIP.has(from)) {
                const isCorresponding = !!moveMatch[1];
                const targets = isCorresponding
                    ? [moveMatch[3].replace(/\..*$/, '').trim().split(/\s+/)[0]].filter((t) => /^[A-Z][A-Z0-9-]+$/i.test(t))
                    : extractMoveTargets(moveMatch[3]);
                if (targets.length > 0) {
                    result.moves.push({
                        from: moveMatch[2],
                        targets,
                        line: lineNum,
                        caller: currentParagraph,
                        corresponding: isCorresponding,
                    });
                }
            }
        }
        const gotoMatch = line.match(RE_GOTO);
        if (gotoMatch) {
            const targets = gotoMatch[1]
                .trim()
                .split(/\s+/)
                .filter((t) => /^[A-Z][A-Z0-9-]+$/i.test(t));
            for (const target of targets) {
                result.gotos.push({ caller: currentParagraph, target, line: lineNum });
            }
        }
        if (sortAccum !== null) {
            sortAccum += ' ' + line;
            if (!/\.\s*$/.test(sortAccum))
                return;
            flushSort();
        }
        const sortMatch = line.match(RE_SORT) || line.match(RE_MERGE);
        if (sortMatch && sortAccum === null) {
            sortAccum = line;
            sortStartLine = lineNum;
            if (!/\.\s*$/.test(sortAccum))
                return;
            flushSort();
        }
        if (inspectAccum !== null) {
            const inspTrimmed = line.trimStart();
            const inspLeading = line.match(/^(\s*)/)?.[1].length ?? 0;
            const inspIsAreaAPara = RE_PROC_PARAGRAPH.test(line) && (!isFreeFormat ? inspLeading <= 7 : false);
            if (RE_PROC_SECTION.test(line) ||
                inspIsAreaAPara ||
                RE_STATEMENT_VERB_START.test(inspTrimmed) ||
                /^CALL(?:\s|$)/i.test(inspTrimmed)) {
                flushInspect();
            }
            else {
                inspectAccum += ' ' + line;
                if (/\.\s*$/.test(inspectAccum)) {
                    flushInspect();
                }
                else {
                    return;
                }
            }
        }
        const inspectMatch = line.match(/\bINSPECT\s+([A-Z][A-Z0-9-]+)/i);
        if (inspectMatch && inspectAccum === null) {
            inspectAccum = line;
            inspectStartLine = lineNum;
            if (!/\.\s*$/.test(inspectAccum))
                return;
            flushInspect();
        }
        const searchMatch = line.match(RE_SEARCH);
        if (searchMatch) {
            result.searches.push({ target: searchMatch[1], line: lineNum });
        }
        for (const cancelMatch of line.matchAll(RE_CANCEL)) {
            result.cancels.push({
                target: cancelMatch[1] ?? cancelMatch[2],
                line: lineNum,
                isQuoted: true,
            });
        }
        for (const dynCancelMatch of line.matchAll(RE_CANCEL_DYNAMIC)) {
            result.cancels.push({ target: dynCancelMatch[1], line: lineNum, isQuoted: false });
        }
        const setTrueMatch = line.match(RE_SET_TO_TRUE);
        if (setTrueMatch) {
            const targets = setTrueMatch[1]
                .trim()
                .split(/\s+/)
                .filter((t) => /^[A-Z][A-Z0-9-]+$/i.test(t) && t.toUpperCase() !== 'OF');
            if (targets.length > 0) {
                result.sets.push({ targets, form: 'to-true', line: lineNum, caller: currentParagraph });
            }
        }
        else {
            const setIdxMatch = line.match(RE_SET_INDEX);
            if (setIdxMatch) {
                const targets = setIdxMatch[1]
                    .trim()
                    .split(/\s+/)
                    .filter((t) => /^[A-Z][A-Z0-9-]+$/i.test(t));
                const mode = setIdxMatch[2].toUpperCase();
                const form = mode === 'TO'
                    ? 'to-value'
                    : mode.startsWith('UP')
                        ? 'up-by'
                        : 'down-by';
                result.sets.push({
                    targets,
                    form,
                    value: setIdxMatch[3],
                    line: lineNum,
                    caller: currentParagraph,
                });
            }
        }
        const initMatch = line.match(RE_INITIALIZE);
        if (initMatch) {
            const targets = initMatch[1]
                .trim()
                .split(/\s+/)
                .filter((t) => /^[A-Z][A-Z0-9-]+$/i.test(t) && !INITIALIZE_CLAUSE_KEYWORDS.has(t.toUpperCase()));
            for (const target of targets) {
                result.initializes.push({ target, line: lineNum, caller: currentParagraph });
            }
        }
    }
}
