import type { FileDeclaration } from '../types.js';
export declare function extractMoveTargets(afterTo: string): string[];
export declare function parseDataItemClauses(rest: string): {
    pic?: string;
    usage?: string;
    redefines?: string;
    occurs?: number;
    dependingOn?: string;
    value?: string;
    isExternal?: boolean;
    isGlobal?: boolean;
};
export declare function parseConditionValues(valuesStr: string): string[];
export declare function parseSelectStatement(stmt: string, startLine: number): FileDeclaration | null;
