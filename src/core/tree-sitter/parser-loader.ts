import { Parser, Language } from 'web-tree-sitter';
import { createRequire } from 'node:module';
import { SupportedLanguages } from 'gitnexus-shared';
import { DEV_APP_ROOT_URL } from '../../generated/constants.js';
import { getPortability } from '../portability/index.js';
import { LoggerProviderRegistry } from '../config/LoggerProviderRegistry.js';
const logger = LoggerProviderRegistry.get();
import { isWasmGrammarAvailable, loadWasmGrammar, initWasmRuntime } from './wasm-bridge.js';

/**
 * One row per (language, optional variant) describes how to obtain a
 * grammar object suitable for `Parser.setLanguage`.
 *
 *   - `load`             — returns the grammar object (lazy, called on
 *                          first use, then cached).
 *   - `unavailableNote`  — actionable message surfaced *whenever* the
 *                          grammar can't be loaded. Mandatory for every
 *                          row so failures are never silent and never
 *                          generic.
 *   - `optional`         — when true, a load failure does not throw:
 *                          we report the language as unavailable and
 *                          let callers skip files of this language.
 *                          When false (the default), a load failure
 *                          re-throws the original error so the
 *                          pipeline halts loudly.
 *   - `severity`         — log level for failure diagnostics. Defaults
 *                          to `error` for required grammars and `warn`
 *                          for optional ones. Set explicitly to `error`
 *                          on optional rows whose package is listed in
 *                          `dependencies` (not `optionalDependencies`):
 *                          those failures indicate a real install
 *                          problem and should never be hidden behind
 *                          a low-severity warning.
 *
 * Adding or removing a grammar is one entry in this table — there is
 * no second list, no conditional spread, and no per-grammar branch in
 * the resolver.
 */
interface GrammarSource {
  /** For WASM grammars: key into the wasm-bridge language map. */
  wasmKey?: string;
  /** For native grammars: sync loader. Absent for WASM grammars. */
  load?: () => unknown;
  unavailableNote: string;
  optional?: boolean;
  severity?: 'warn' | 'error';
}

const ISSUES_URL = 'https://github.com/abhigyanpatwari/GitNexus/issues';

const G = SupportedLanguages;

// ── Lazy native module loader (dev mode only) ───────────────────────────

let nativeRequire: ReturnType<typeof createRequire> | null = null;

function getNativeRequire(): ReturnType<typeof createRequire> | null {
  if (!getPortability().hasNativeAddons) return null;
  if (nativeRequire) return nativeRequire;
  try {
    // DEV_APP_ROOT_URL is a compile-time constant from generated/constants.ts
    // In dev mode: file:///.../gitnexus/ (real filesystem path)
    // In portable mode: null (native modules unavailable)
    if (DEV_APP_ROOT_URL) {
      nativeRequire = createRequire(DEV_APP_ROOT_URL);
      return nativeRequire;
    }
  } catch {
    // Fall through — native modules unavailable
  }
  return null;
}

// ── Grammar registry ────────────────────────────────────────────────────
// WASM grammars (12): loaded via web-tree-sitter + embedded .wasm files
// Native grammars (4): C, Swift, Dart, Kotlin — no .wasm available yet

const SOURCES: Record<string, GrammarSource> = {
  [G.JavaScript]: {
    wasmKey: G.JavaScript,
    unavailableNote:
      'JavaScript grammar unavailable: WASM file not embedded. ' +
      'Regenerate via: node scripts/embed-wasm.mjs',
  },
  [G.TypeScript]: {
    wasmKey: G.TypeScript,
    unavailableNote:
      'TypeScript grammar unavailable: WASM file not embedded.',
  },
  [`${G.TypeScript}:tsx`]: {
    wasmKey: `${G.TypeScript}:tsx`,
    unavailableNote:
      'TSX grammar unavailable: WASM file not embedded (piggybacks on TS).',
  },
  [G.Python]: {
    wasmKey: G.Python,
    unavailableNote:
      'Python grammar unavailable: WASM file not embedded.',
  },
  [G.Java]: {
    wasmKey: G.Java,
    unavailableNote:
      'Java grammar unavailable: WASM file not embedded.',
  },
  [G.CSharp]: {
    wasmKey: G.CSharp,
    unavailableNote:
      'C# grammar unavailable: WASM file not embedded.',
  },
  [G.CPlusPlus]: {
    wasmKey: G.CPlusPlus,
    unavailableNote:
      'C++ grammar unavailable: WASM file not embedded.',
  },
  [G.Go]: {
    wasmKey: G.Go,
    unavailableNote:
      'Go grammar unavailable: WASM file not embedded.',
  },
  [G.Rust]: {
    wasmKey: G.Rust,
    unavailableNote:
      'Rust grammar unavailable: WASM file not embedded.',
  },
  [G.PHP]: {
    wasmKey: G.PHP,
    unavailableNote:
      'PHP grammar unavailable: WASM file not embedded.',
  },
  [G.Ruby]: {
    wasmKey: G.Ruby,
    unavailableNote:
      'Ruby grammar unavailable: WASM file not embedded.',
  },
  [G.Vue]: {
    wasmKey: G.Vue,
    unavailableNote:
      'Vue grammar unavailable: WASM file not embedded (piggybacks on TS).',
  },

  // C — no WASM grammar (tree-sitter-c v0.21.4 doesn't ship .wasm)
  // Native fallback only, in dev mode.
  [G.C]: {
    load: () => {
      const r = getNativeRequire();
      if (!r) throw new Error('C grammar unavailable: native addons not supported in portable mode.');
      return r('tree-sitter-c');
    },
    optional: true,
    severity: 'error',
    unavailableNote:
      'C parsing disabled: `tree-sitter-c` (v0.21.4) could not be loaded. ' +
      'In dev mode, try `npm rebuild tree-sitter-c`. ' +
      'In portable mode, C parsing is unavailable (no WASM grammar — upgrade to tree-sitter-c >=0.23).',
  },

  [G.Swift]: {
    load: () => {
      const r = getNativeRequire();
      if (!r) throw new Error('Swift grammar unavailable: native addons not supported in portable mode.');
      return r('tree-sitter-swift');
    },
    optional: true,
    unavailableNote:
      'Swift parsing disabled: vendored `tree-sitter-swift` failed to load. ' +
      'In portable mode, Swift parsing is unavailable (no WASM grammar).',
  },
  [G.Dart]: {
    load: () => {
      const r = getNativeRequire();
      if (!r) throw new Error('Dart grammar unavailable: native addons not supported in portable mode.');
      return r('tree-sitter-dart');
    },
    optional: true,
    unavailableNote:
      'Dart parsing disabled: vendored `tree-sitter-dart` failed to load. ' +
      'In portable mode, Dart parsing is unavailable (no WASM grammar).',
  },
  [G.Kotlin]: {
    load: () => {
      const r = getNativeRequire();
      if (!r) throw new Error('Kotlin grammar unavailable: native addons not supported in portable mode.');
      return r('tree-sitter-kotlin');
    },
    optional: true,
    unavailableNote:
      'Kotlin parsing disabled: `tree-sitter-kotlin` failed to load. ' +
      'In portable mode, Kotlin parsing is unavailable (no WASM grammar).',
  },
};

type LoadResult =
  | { ok: true; grammar: unknown }
  | { ok: false; error: Error; note: string; fatal: boolean; severity: 'warn' | 'error' };

const loadCache = new Map<string, LoadResult>();
const logged = new Set<string>();

const logFailure = (key: string, result: LoadResult): void => {
  if (result.ok === true) return;
  if (logged.has(key)) return;
  logged.add(key);
  const message = `[gitnexus] ${result.note} (${result.error.message})`;

  // Severity routes to the correct pino level. Both go to stderr (pino's
  // default destination), so MCP stdio framing is preserved either way —
  // the level tag drives log filtering, not channel selection.
  if (result.severity === 'error') {
    logger.error(message);
  } else {
    logger.warn(message);
  }
};

export const resolveLanguageKey = (language: SupportedLanguages, filePath?: string): string =>
  language === SupportedLanguages.TypeScript && filePath?.endsWith('.tsx')
    ? `${language}:tsx`
    : language;

const loadGrammar = (key: string): LoadResult => {
  const cached = loadCache.get(key);
  if (cached) return cached;

  const source = SOURCES[key];
  if (!source) {
    const result: LoadResult = {
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
    const result: LoadResult = available
      ? { ok: true, grammar: null }
      : {
          ok: false,
          error: new Error(`WASM grammar not embedded: ${key}`),
          note: source.unavailableNote,
          fatal: !source.optional,
          severity: source.severity ?? (!source.optional ? 'error' : 'warn'),
        };
    loadCache.set(key, result);
    if (!available) logFailure(key, result);
    return result;
  }

  // Native source: sync loading via createRequire (dev mode only)
  if (!source.load) {
    const result: LoadResult = {
      ok: false,
      error: new Error(`Grammar source has neither wasmKey nor load: ${key}`),
      note: `Grammar misconfigured: ${key}`,
      fatal: true,
      severity: 'error',
    };
    loadCache.set(key, result);
    return result;
  }

  let result: LoadResult;
  try {
    result = { ok: true, grammar: source.load() };
  } catch (err) {
    const fatal = !source.optional;
    result = {
      ok: false,
      error: err as Error,
      note: source.unavailableNote,
      fatal,
      severity: source.severity ?? (fatal ? 'error' : 'warn'),
    };
  }
  loadCache.set(key, result);
  if (result.ok === false) logFailure(key, result);
  return result;
};

export const isLanguageAvailable = (language: SupportedLanguages, filePath?: string): boolean =>
  loadGrammar(resolveLanguageKey(language, filePath)).ok;

export const getLanguageGrammar = (language: SupportedLanguages, filePath?: string): unknown => {
  const key = resolveLanguageKey(language, filePath);
  const result = loadGrammar(key);
  if (result.ok === true) {
    // WASM grammar marked available but not yet loaded — the caller must
    // use loadLanguage() or createParserForLanguage() to trigger async load.
    if (result.grammar === null) {
      throw new Error(
        `Language "${key}" not loaded yet. Call loadLanguage() first.`,
      );
    }
    return result.grammar;
  }
  if (result.fatal) throw result.error;
  throw new Error(`Unsupported language: ${language}`);
};

let sharedParser: Parser | null = null;

async function ensureGrammarLoaded(key: string): Promise<void> {
  const cached = loadCache.get(key);
  if (cached?.ok === true && cached.grammar !== null) return;

  const source = SOURCES[key];
  if (!source?.wasmKey) return; // native grammars, loaded sync already

  try {
    await initWasmRuntime();
    const language = await loadWasmGrammar(key);
    if (language) {
      loadCache.set(key, { ok: true, grammar: language });
    } else {
      // WASM grammar wasn't embedded — keep the existing cached failure result
    }
  } catch (err) {
    const result: LoadResult = {
      ok: false,
      error: err as Error,
      note: `Failed to load WASM grammar for ${key}: ${(err as Error).message}`,
      fatal: !source.optional,
      severity: source.severity ?? 'error',
    };
    loadCache.set(key, result);
    logFailure(key, result);
  }
}

export const loadParser = async (): Promise<Parser> => {
  await initWasmRuntime();
  return (sharedParser ??= new Parser());
};

export const loadLanguage = async (
  language: SupportedLanguages,
  filePath?: string,
): Promise<void> => {
  const key = resolveLanguageKey(language, filePath);
  await ensureGrammarLoaded(key);
  const parser = await loadParser();
  parser.setLanguage(getLanguageGrammar(language, filePath) as Language);
};

export const createParserForLanguage = async (
  language: SupportedLanguages,
  filePath?: string,
): Promise<Parser> => {
  const key = resolveLanguageKey(language, filePath);
  await ensureGrammarLoaded(key);
  await initWasmRuntime();
  const parser = new Parser();
  parser.setLanguage(getLanguageGrammar(language, filePath) as Language);
  return parser;
};
