import { SupportedLanguages } from '../../../_shared/index.js';
import { TYPESCRIPT_QUERIES, JAVASCRIPT_QUERIES } from './typescript.js';
import { PYTHON_QUERIES } from './python.js';
import { JAVA_QUERIES } from './java.js';
import { C_QUERIES, CPP_QUERIES } from './c-family.js';
import { GO_QUERIES } from './go.js';
import { CSHARP_QUERIES } from './csharp.js';
import { RUST_QUERIES } from './rust.js';
import { PHP_QUERIES } from './php.js';
import { RUBY_QUERIES } from './ruby.js';
import { KOTLIN_QUERIES } from './kotlin.js';
import { SWIFT_QUERIES } from './swift.js';
import { DART_QUERIES } from './dart.js';
export const LANGUAGE_QUERIES = {
    [SupportedLanguages.TypeScript]: TYPESCRIPT_QUERIES,
    [SupportedLanguages.JavaScript]: JAVASCRIPT_QUERIES,
    [SupportedLanguages.Python]: PYTHON_QUERIES,
    [SupportedLanguages.Java]: JAVA_QUERIES,
    [SupportedLanguages.C]: C_QUERIES,
    [SupportedLanguages.Go]: GO_QUERIES,
    [SupportedLanguages.CPlusPlus]: CPP_QUERIES,
    [SupportedLanguages.CSharp]: CSHARP_QUERIES,
    [SupportedLanguages.Rust]: RUST_QUERIES,
    [SupportedLanguages.PHP]: PHP_QUERIES,
    [SupportedLanguages.Kotlin]: KOTLIN_QUERIES,
    [SupportedLanguages.Ruby]: RUBY_QUERIES,
    [SupportedLanguages.Swift]: SWIFT_QUERIES,
    [SupportedLanguages.Dart]: DART_QUERIES,
    [SupportedLanguages.Vue]: TYPESCRIPT_QUERIES,
    [SupportedLanguages.Cobol]: '',
};
