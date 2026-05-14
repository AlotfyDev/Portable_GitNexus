import { Parser } from 'web-tree-sitter';
import { SupportedLanguages } from '../../_shared/index.js';
export declare const resolveLanguageKey: (language: SupportedLanguages, filePath?: string) => string;
export declare const isLanguageAvailable: (language: SupportedLanguages, filePath?: string) => boolean;
export declare const getLanguageGrammar: (language: SupportedLanguages, filePath?: string) => unknown;
export declare const loadParser: () => Promise<Parser>;
export declare const loadLanguage: (language: SupportedLanguages, filePath?: string) => Promise<void>;
export declare const createParserForLanguage: (language: SupportedLanguages, filePath?: string) => Promise<Parser>;
