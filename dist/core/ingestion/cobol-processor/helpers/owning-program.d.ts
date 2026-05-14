/** Find the enclosing program name for a given line number (innermost wins). */
declare function findOwningProgramName(lineNum: number, programs: Array<{
    name: string;
    startLine: number;
    endLine: number;
    nestingDepth: number;
}>): string | undefined;
/** Find the section that contains a given line number. */
declare function findContainingSection(line: number, sections: Array<{
    name: string;
    line: number;
}>, sectionNodeIds: Map<string, string>, programs: Array<{
    name: string;
    startLine: number;
    endLine: number;
    nestingDepth: number;
}>): string | undefined;
export { findOwningProgramName, findContainingSection };
