import path from 'node:path';
import { COBOL_EXTENSIONS, JCL_EXTENSIONS, COPYBOOK_EXTENSIONS } from './constants.js';

/** Returns true if the file is a COBOL or copybook file. */
export function isCobolFile(filePath: string): boolean {
  return COBOL_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Returns true if the file is a JCL file. */
export function isJclFile(filePath: string): boolean {
  return JCL_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Returns true if the file is a COBOL copybook. */
function isCopybook(filePath: string): boolean {
  return COPYBOOK_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export { isCopybook };
