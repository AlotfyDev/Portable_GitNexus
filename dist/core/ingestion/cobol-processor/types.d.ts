interface CobolFile {
    path: string;
    content: string;
}
export interface CobolProcessResult {
    programs: number;
    paragraphs: number;
    sections: number;
    dataItems: number;
    calls: number;
    copies: number;
    execSqlBlocks: number;
    execCicsBlocks: number;
    entryPoints: number;
    moves: number;
    fileDeclarations: number;
    jclJobs: number;
    jclSteps: number;
    sqlIncludes: number;
    execDliBlocks: number;
    declaratives: number;
    sets: number;
    inspects: number;
    initializes: number;
}
export type { CobolFile };
