/**
 * Capture-match → semantic-shape interpreters.
 *
 * Two pure functions, both consumed by the central scope extractor:
 *
 *   - `interpretPythonImport`     → `ParsedImport`
 *   - `interpretPythonTypeBinding` → `ParsedTypeBinding`
 *
 * The matches arrive pre-decomposed by `emitPythonScopeCaptures`
 * (one imported name per match; synthesized `self`/`cls` markers
 * already attached) so these functions are straight-line tag readers.
 */
import type { CaptureMatch, ParsedImport, ParsedTypeBinding } from '../../../../_shared/index.js';
export declare function interpretPythonImport(captures: CaptureMatch): ParsedImport | null;
export declare function interpretPythonTypeBinding(captures: CaptureMatch): ParsedTypeBinding | null;
