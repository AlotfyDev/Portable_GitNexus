import type { CobolRegexResults } from '../types.js';
export declare function parseExecSqlBlock(block: string, line: number): CobolRegexResults['execSqlBlocks'][number];
export declare function parseExecCicsBlock(block: string, line: number): CobolRegexResults['execCicsBlocks'][number];
export declare function parseExecDliBlock(block: string, line: number): CobolRegexResults['execDliBlocks'][number];
