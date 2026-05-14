export const USING_KEYWORDS = new Set([
    'BY',
    'VALUE',
    'REFERENCE',
    'CONTENT',
    'ADDRESS',
    'OF',
    'RETURNING',
]);
export const CALL_USING_FILTER = new Set([
    'BY',
    'REFERENCE',
    'CONTENT',
    'VALUE',
    'ADDRESS',
    'OF',
    'LENGTH',
    'OMITTED',
]);
export const EXCLUDED_PARA_NAMES = new Set([
    'DECLARATIVES',
    'END',
    'PROCEDURE',
    'IDENTIFICATION',
    'ENVIRONMENT',
    'DATA',
    'WORKING-STORAGE',
    'LINKAGE',
    'FILE',
    'LOCAL-STORAGE',
    'COMMUNICATION',
    'REPORT',
    'SCREEN',
    'INPUT-OUTPUT',
    'CONFIGURATION',
    'GOBACK',
    'STOP',
    'EXIT',
    'CONTINUE',
    'DISPLAY',
    'ACCEPT',
    'WRITE',
    'READ',
    'REWRITE',
    'DELETE',
    'OPEN',
    'CLOSE',
    'RETURN',
    'RELEASE',
    'SORT',
    'MERGE',
]);
export const RE_DIVISION = /\b(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION\b/i;
export const RE_SECTION = /\b(WORKING-STORAGE|LINKAGE|FILE|LOCAL-STORAGE|SCREEN|INPUT-OUTPUT|CONFIGURATION)\s+SECTION\b/i;
export const RE_PROGRAM_ID = /\bPROGRAM-ID\.\s*([A-Z][A-Z0-9-]*)(?:\s+IS\s+COMMON)?/i;
export const RE_END_PROGRAM = /\bEND\s+PROGRAM\s+([A-Z][A-Z0-9-]*)\s*\./i;
export const RE_AUTHOR = /^\s+AUTHOR\.\s*(.+)/i;
export const RE_DATE_WRITTEN = /^\s+DATE-WRITTEN\.\s*(.+)/i;
export const RE_DATE_COMPILED = /^\s+DATE-COMPILED\.\s*(.+)/i;
export const RE_INSTALLATION = /^\s+INSTALLATION\.\s*(.+)/i;
export const RE_SELECT_START = /\bSELECT\s+(?:OPTIONAL\s+)?([A-Z][A-Z0-9-]+)/i;
export const RE_FD = /^\s*(?:FD|SD|RD)\s+([A-Z][A-Z0-9-]+)/i;
export const RE_DATA_ITEM = /^\s*(\d{1,2})\s+([A-Z][A-Z0-9-]+)\s*(.*)/i;
export const RE_ANONYMOUS_REDEFINES = /^\s*(\d{1,2})\s+REDEFINES\s+([A-Z][A-Z0-9-]+)/i;
export const RE_88_LEVEL = /^\s*88\s+([A-Z][A-Z0-9-]+)\s+VALUES?\s+(?:ARE\s+)?(.+)/i;
export const RE_PROC_SECTION = /^\s*([A-Z][A-Z0-9-]+)\s+SECTION(?:\s+\d+)?\.\s*$/i;
export const RE_PROC_PARAGRAPH = /^\s*([A-Z][A-Z0-9-]+)\.\s*$/i;
export const RE_PERFORM = /\bPERFORM\s+([A-Z][A-Z0-9-]+)(?:\s+(?:THRU|THROUGH)\s+([A-Z][A-Z0-9-]+))?/gi;
export const RE_CALL = /\bCALL\s+(?:"([^"]+)"|'([^']+)')/gi;
export const RE_CALL_DYNAMIC = /(?<![A-Z0-9-])\bCALL\s+([A-Z][A-Z0-9-]+)(?=\s|\.|$)/gi;
export const RE_COPY_UNQUOTED = /\bCOPY\s+([A-Z][A-Z0-9-]+)(?:\s|\.)/i;
export const RE_COPY_QUOTED = /\bCOPY\s+(?:"([^"]+)"|'([^']+)')(?:\s|\.)/i;
export const RE_EXEC_SQL_START = /\bEXEC\s+SQL\b/i;
export const RE_EXEC_CICS_START = /\bEXEC\s+CICS\b/i;
export const RE_END_EXEC = /\bEND-EXEC\b/i;
export const RE_GOTO = /\bGO\s+TO\s+([A-Z][A-Z0-9-]+(?:\s+[A-Z][A-Z0-9-]+)*?)(?:\s+DEPENDING\s+ON\s+[A-Z][A-Z0-9-]+)?(?:\s*\.|$)/i;
export const RE_SORT = /\bSORT\s+([A-Z][A-Z0-9-]+)/i;
export const RE_MERGE = /\bMERGE\s+([A-Z][A-Z0-9-]+)/i;
export const RE_SEARCH = /\bSEARCH\s+(?:ALL\s+)?([A-Z][A-Z0-9-]+)/i;
export const RE_CANCEL = /\bCANCEL\s+(?:"([^"]+)"|'([^']+)')/gi;
export const RE_CANCEL_DYNAMIC = /(?<![A-Z0-9-])\bCANCEL\s+([A-Z][A-Z0-9-]+)(?=\s|\.|$)/gi;
export const RE_66_LEVEL = /^\s*66\s+([A-Z][A-Z0-9-]+)\s+RENAMES\s+([A-Z][A-Z0-9-]+)/i;
export const RE_DECLARATIVES_START = /^\s*DECLARATIVES\s*\.\s*$/i;
export const RE_DECLARATIVES_END = /^\s*END\s+DECLARATIVES\s*\.\s*$/i;
export const RE_USE_AFTER = /\bUSE\s+(?:AFTER\s+)?(?:STANDARD\s+)?(?:EXCEPTION|ERROR)\s+ON\s+([A-Z][A-Z0-9-]+|INPUT|OUTPUT|I-O|EXTEND)\b/i;
export const RE_SET_TO_TRUE = /\bSET\s+(.+?)\s+TO\s+TRUE\b/i;
export const RE_SET_INDEX = /\bSET\s+(.+?)\s+(TO|UP\s+BY|DOWN\s+BY)\s+(\d+|[A-Z][A-Z0-9-]+)/i;
export const RE_INITIALIZE = /\bINITIALIZE\s+([\s\S]*?)(?=\bREPLACING\b|\bWITH\b|\.\s*$|$)/i;
export const INITIALIZE_CLAUSE_KEYWORDS = new Set([
    'REPLACING',
    'WITH',
    'ALL',
    'ALPHABETIC',
    'ALPHANUMERIC',
    'NUMERIC',
    'NATIONAL',
    'DBCS',
    'EGCS',
    'FILLER',
]);
export const RE_EXEC_DLI_START = /\bEXEC\s+DLI\b/i;
export const RE_PROC_USING = /\bPROCEDURE\s+DIVISION\s+USING\s+([\s\S]*?)(?:\.|$)/i;
export const RE_ENTRY = /\bENTRY\s+(?:"([^"]+)"|'([^']+)')(?:\s+USING\s+([\s\S]*?))?(?:\.|$)/i;
export const RE_MOVE = /\bMOVE\s+((?:CORRESPONDING|CORR)\s+)?([A-Z][A-Z0-9-]+)\s+TO\s+(.+)/i;
export const MOVE_SKIP = new Set([
    'SPACES',
    'ZEROS',
    'ZEROES',
    'LOW-VALUES',
    'LOW-VALUE',
    'HIGH-VALUES',
    'HIGH-VALUE',
    'QUOTES',
    'QUOTE',
    'ALL',
]);
export const PERFORM_KEYWORD_SKIP = new Set(['UNTIL', 'VARYING', 'WITH', 'TEST', 'FOREVER']);
export const SORT_CLAUSE_NOISE = new Set([
    'ON',
    'ASCENDING',
    'DESCENDING',
    'KEY',
    'WITH',
    'DUPLICATES',
    'IN',
    'ORDER',
    'COLLATING',
    'SEQUENCE',
    'IS',
    'THROUGH',
    'THRU',
    'INPUT',
    'OUTPUT',
    'PROCEDURE',
    'USING',
    'GIVING',
]);
export const COBOL_STATEMENT_VERBS = [
    'GO\\s+TO',
    'PERFORM',
    'MOVE',
    'DISPLAY',
    'ACCEPT',
    'INSPECT',
    'SEARCH',
    'SORT',
    'MERGE',
    'IF',
    'EVALUATE',
    'SET',
    'INITIALIZE',
    'STOP',
    'EXIT',
    'GOBACK',
    'CONTINUE',
    'READ',
    'WRITE',
    'REWRITE',
    'DELETE',
    'OPEN',
    'CLOSE',
    'START',
    'CANCEL',
    'COMPUTE',
    'ADD',
    'SUBTRACT',
    'MULTIPLY',
    'DIVIDE',
    'STRING',
    'UNSTRING',
];
export const RE_STATEMENT_VERB_START = new RegExp(`^(?:${COBOL_STATEMENT_VERBS.join('|')})(?:\\s|$)`, 'i');
export const USING_VERB_LOOKAHEAD = [...COBOL_STATEMENT_VERBS, 'CALL']
    .filter((v) => v !== 'GO\\s+TO')
    .map((v) => `\\b${v}(?=\\s|$)`)
    .join('|');
export const RE_USING_PARAMS = new RegExp(`\\bUSING\\s+([\\s\\S]*?)(?=\\bRETURNING\\b|\\bON\\s+(?:EXCEPTION|OVERFLOW)\\b|\\bNOT\\s+ON\\b|\\bEND-CALL\\b|\\bGO\\s+TO\\b|${USING_VERB_LOOKAHEAD}|\\.\\s*$|$)`, 'i');
