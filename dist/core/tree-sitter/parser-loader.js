import { Parser } from 'web-tree-sitter';
import { createRequire } from 'node:module';
import { SupportedLanguages } from '../../_shared/index.js';
import { DEV_APP_ROOT_URL } from '../../generated/constants.js';
import { getPortability } from '../portability/index.js';
import { logger } from '../logger.js';
import { isWasmGrammarAvailable, loadWasmGrammar, initWasmRuntime } from './wasm-bridge.js';
const ISSUES_URL = 'https://github.com/abhigyanpatwari/GitNexus/issues';
const G = SupportedLanguages;
// ── Lazy native module loader (dev mode only) ───────────────────────────
let nativeRequire = null;
function getNativeRequire() {
    if (!getPortability().hasNativeAddons)
        return null;
    if (nativeRequire)
        return nativeRequire;
    try {
        // DEV_APP_ROOT_URL is a compile-time constant from generated/constants.ts
        // In dev mode: file:///.../gitnexus/ (real filesystem path)
        // In portable mode: null (native modules unavailable)
        if (DEV_APP_ROOT_URL) {
            nativeRequire = createRequire(DEV_APP_ROOT_URL);
            return nativeRequire;
        }
    }
    catch {
        // Fall through — native modules unavailable
    }
    return null;
}
// ── Grammar registry ────────────────────────────────────────────────────
// WASM grammars (12): loaded via web-tree-sitter + embedded .wasm files
// Native grammars (4): C, Swift, Dart, Kotlin — no .wasm available yet
const SOURCES = {
    [G.JavaScript]: {
        wasmKey: G.JavaScript,
        unavailableNote: 'JavaScript grammar unavailable: WASM file not embedded. ' +
            'Regenerate via: node scripts/embed-wasm.mjs',
    },
    [G.TypeScript]: {
        wasmKey: G.TypeScript,
        unavailableNote: 'TypeScript grammar unavailable: WASM file not embedded.',
    },
    [`${G.TypeScript}:tsx`]: {
        wasmKey: `${G.TypeScript}:tsx`,
        unavailableNote: 'TSX grammar unavailable: WASM file not embedded (piggybacks on TS).',
    },
    [G.Python]: {
        wasmKey: G.Python,
        unavailableNote: 'Python grammar unavailable: WASM file not embedded.',
    },
    [G.Java]: {
        wasmKey: G.Java,
        unavailableNote: 'Java grammar unavailable: WASM file not embedded.',
    },
    [G.CSharp]: {
        wasmKey: G.CSharp,
        unavailableNote: 'C# grammar unavailable: WASM file not embedded.',
    },
    [G.CPlusPlus]: {
        wasmKey: G.CPlusPlus,
        unavailableNote: 'C++ grammar unavailable: WASM file not embedded.',
    },
    [G.Go]: {
        wasmKey: G.Go,
        unavailableNote: 'Go grammar unavailable: WASM file not embedded.',
    },
    [G.Rust]: {
        wasmKey: G.Rust,
        unavailableNote: 'Rust grammar unavailable: WASM file not embedded.',
    },
    [G.PHP]: {
        wasmKey: G.PHP,
        unavailableNote: 'PHP grammar unavailable: WASM file not embedded.',
    },
    [G.Ruby]: {
        wasmKey: G.Ruby,
        unavailableNote: 'Ruby grammar unavailable: WASM file not embedded.',
    },
    [G.Vue]: {
        wasmKey: G.Vue,
        unavailableNote: 'Vue grammar unavailable: WASM file not embedded (piggybacks on TS).',
    },
    // C — no WASM grammar (tree-sitter-c v0.21.4 doesn't ship .wasm)
    // Native fallback only, in dev mode.
    [G.C]: {
        load: () => {
            const r = getNativeRequire();
            if (!r)
                throw new Error('C grammar unavailable: native addons not supported in portable mode.');
            return r('tree-sitter-c');
        },
        optional: true,
        severity: 'error',
        unavailableNote: 'C parsing disabled: `tree-sitter-c` (v0.21.4) could not be loaded. ' +
            'In dev mode, try `npm rebuild tree-sitter-c`. ' +
            'In portable mode, C parsing is unavailable (no WASM grammar — upgrade to tree-sitter-c >=0.23).',
    },
    [G.Swift]: {
        load: () => {
            const r = getNativeRequire();
            if (!r)
                throw new Error('Swift grammar unavailable: native addons not supported in portable mode.');
            return r('tree-sitter-swift');
        },
        optional: true,
        unavailableNote: 'Swift parsing disabled: vendored `tree-sitter-swift` failed to load. ' +
            'In portable mode, Swift parsing is unavailable (no WASM grammar).',
    },
    [G.Dart]: {
        load: () => {
            const r = getNativeRequire();
            if (!r)
                throw new Error('Dart grammar unavailable: native addons not supported in portable mode.');
            return r('tree-sitter-dart');
        },
        optional: true,
        unavailableNote: 'Dart parsing disabled: vendored `tree-sitter-dart` failed to load. ' +
            'In portable mode, Dart parsing is unavailable (no WASM grammar).',
    },
    [G.Kotlin]: {
        load: () => {
            const r = getNativeRequire();
            if (!r)
                throw new Error('Kotlin grammar unavailable: native addons not supported in portable mode.');
            return r('tree-sitter-kotlin');
        },
        optional: true,
        unavailableNote: 'Kotlin parsing disabled: `tree-sitter-kotlin` failed to load. ' +
            'In portable mode, Kotlin parsing is unavailable (no WASM grammar).',
    },
};
const loadCache = new Map();
const logged = new Set();
const logFailure = (key, result) => {
    if (result.ok === true)
        return;
    if (logged.has(key))
        return;
    logged.add(key);
    const message = `[gitnexus] ${result.note} (${result.error.message})`;
    // Severity routes to the correct pino level. Both go to stderr (pino's
    // default destination), so MCP stdio framing is preserved either way —
    // the level tag drives log filtering, not channel selection.
    if (result.severity === 'error') {
        logger.error(message);
    }
    else {
        logger.warn(message);
    }
};
export const resolveLanguageKey = (language, filePath) => language === SupportedLanguages.TypeScript && filePath?.endsWith('.tsx')
    ? `${language}:tsx`
    : language;
const loadGrammar = (key) => {
    const cached = loadCache.get(key);
    if (cached)
        return cached;
    const source = SOURCES[key];
    if (!source) {
        const result = {
            ok: false,
            error: new Error(`Unsupported language: ${key}`),
            note: `No grammar registered for language key \`${key}\`. Add a row to SOURCES.`,
            fatal: true,
            severity: 'error',
        };
        loadCache.set(key, result);
        return result;
    }
    // WASM source: sync check returns available flag, grammar loaded async later
    if (source.wasmKey) {
        const available = isWasmGrammarAvailable(key);
        const result = available
            ? { ok: true, grammar: null }
            : {
                ok: false,
                error: new Error(`WASM grammar not embedded: ${key}`),
                note: source.unavailableNote,
                fatal: !source.optional,
                severity: source.severity ?? (!source.optional ? 'error' : 'warn'),
            };
        loadCache.set(key, result);
        if (!available)
            logFailure(key, result);
        return result;
    }
    // Native source: sync loading via createRequire (dev mode only)
    if (!source.load) {
        const result = {
            ok: false,
            error: new Error(`Grammar source has neither wasmKey nor load: ${key}`),
            note: `Grammar misconfigured: ${key}`,
            fatal: true,
            severity: 'error',
        };
        loadCache.set(key, result);
        return result;
    }
    let result;
    try {
        result = { ok: true, grammar: source.load() };
    }
    catch (err) {
        const fatal = !source.optional;
        result = {
            ok: false,
            error: err,
            note: source.unavailableNote,
            fatal,
            severity: source.severity ?? (fatal ? 'error' : 'warn'),
        };
    }
    loadCache.set(key, result);
    if (result.ok === false)
        logFailure(key, result);
    return result;
};
export const isLanguageAvailable = (language, filePath) => loadGrammar(resolveLanguageKey(language, filePath)).ok;
export const getLanguageGrammar = (language, filePath) => {
    const key = resolveLanguageKey(language, filePath);
    const result = loadGrammar(key);
    if (result.ok === true) {
        // WASM grammar marked available but not yet loaded — the caller must
        // use loadLanguage() or createParserForLanguage() to trigger async load.
        if (result.grammar === null) {
            throw new Error(`Language "${key}" not loaded yet. Call loadLanguage() first.`);
        }
        return result.grammar;
    }
    if (result.fatal)
        throw result.error;
    throw new Error(`Unsupported language: ${language}`);
};
let sharedParser = null;
async function ensureGrammarLoaded(key) {
    const cached = loadCache.get(key);
    if (cached?.ok === true && cached.grammar !== null)
        return;
    const source = SOURCES[key];
    if (!source?.wasmKey)
        return; // native grammars, loaded sync already
    try {
        await initWasmRuntime();
        const language = await loadWasmGrammar(key);
        if (language) {
            loadCache.set(key, { ok: true, grammar: language });
        }
        else {
            // WASM grammar wasn't embedded — keep the existing cached failure result
        }
    }
    catch (err) {
        const result = {
            ok: false,
            error: err,
            note: `Failed to load WASM grammar for ${key}: ${err.message}`,
            fatal: !source.optional,
            severity: source.severity ?? 'error',
        };
        loadCache.set(key, result);
        logFailure(key, result);
    }
}
export const loadParser = async () => {
    await initWasmRuntime();
    return (sharedParser ??= new Parser());
};
export const loadLanguage = async (language, filePath) => {
    const key = resolveLanguageKey(language, filePath);
    await ensureGrammarLoaded(key);
    const parser = await loadParser();
    parser.setLanguage(getLanguageGrammar(language, filePath));
};
export const createParserForLanguage = async (language, filePath) => {
    const key = resolveLanguageKey(language, filePath);
    await ensureGrammarLoaded(key);
    await initWasmRuntime();
    const parser = new Parser();
    parser.setLanguage(getLanguageGrammar(language, filePath));
    return parser;
};
