/** Find the enclosing program name for a given line number (innermost wins). */
function findOwningProgramName(lineNum, programs) {
    let best;
    for (const p of programs) {
        if (p.startLine <= lineNum && p.endLine >= lineNum) {
            if (!best || p.nestingDepth > best.nestingDepth)
                best = p;
        }
    }
    return best?.name;
}
/** Find the section that contains a given line number. */
function findContainingSection(line, sections, sectionNodeIds, programs) {
    const pgm = findOwningProgramName(line, programs);
    let best;
    for (const sec of sections) {
        if (sec.line <= line) {
            const resolved = sectionNodeIds.get(`${pgm ?? ''}:${sec.name.toUpperCase()}`);
            if (resolved)
                best = resolved;
        }
        else {
            break;
        }
    }
    return best;
}
export { findOwningProgramName, findContainingSection };
