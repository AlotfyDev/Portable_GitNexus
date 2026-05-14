/** Find the enclosing program name for a given line number (innermost wins). */
function findOwningProgramName(
  lineNum: number,
  programs: Array<{ name: string; startLine: number; endLine: number; nestingDepth: number }>,
): string | undefined {
  let best: (typeof programs)[0] | undefined;
  for (const p of programs) {
    if (p.startLine <= lineNum && p.endLine >= lineNum) {
      if (!best || p.nestingDepth > best.nestingDepth) best = p;
    }
  }
  return best?.name;
}

/** Find the section that contains a given line number. */
function findContainingSection(
  line: number,
  sections: Array<{ name: string; line: number }>,
  sectionNodeIds: Map<string, string>,
  programs: Array<{ name: string; startLine: number; endLine: number; nestingDepth: number }>,
): string | undefined {
  const pgm = findOwningProgramName(line, programs);
  let best: string | undefined;
  for (const sec of sections) {
    if (sec.line <= line) {
      const resolved = sectionNodeIds.get(`${pgm ?? ''}:${sec.name.toUpperCase()}`);
      if (resolved) best = resolved;
    } else {
      break;
    }
  }
  return best;
}

export { findOwningProgramName, findContainingSection };
