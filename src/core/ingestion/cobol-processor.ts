/**
 * COBOL Processor
 *
 * Standalone regex-based processor for COBOL and JCL files.
 * Barrel file — delegates to modular cobol-processor/ directory.
 */

export { isCobolFile, isJclFile } from './cobol-processor/detectors.js';
export { processCobol } from './cobol-processor/process-main.js';
