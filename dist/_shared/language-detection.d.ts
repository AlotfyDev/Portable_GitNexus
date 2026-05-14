/**
 * Language Detection — maps file paths to SupportedLanguages enum values.
 *
 * Shared between CLI (ingestion pipeline) and web (syntax highlighting).
 *
 * ADDING A NEW LANGUAGE:
 * 1. Add enum member to SupportedLanguages in languages.ts
 * 2. Add file extensions to EXTENSION_MAP below
 * 3. TypeScript will error if you miss either step (exhaustive Record)
 */
import { SupportedLanguages } from './languages.js';
/**
 * Map file extension to SupportedLanguage enum.
 * Returns null if the file extension is not recognized.
 */
export declare const getLanguageFromFilename: (filename: string) => SupportedLanguages | null;
/**
 * Map file path to a Prism-compatible syntax highlight language string.
 * Covers all SupportedLanguages (code files) plus common non-code formats.
 * Returns 'text' for unrecognised files.
 */
export declare const getSyntaxLanguageFromFilename: (filePath: string) => string;
//# sourceMappingURL=language-detection.d.ts.map