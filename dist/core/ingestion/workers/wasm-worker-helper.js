// WASM worker helper — provides WASM-based Parser init and grammar loading
// for parse-worker.js. Uses web-tree-sitter instead of native tree-sitter addons.
import { Parser, Language } from 'web-tree-sitter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SupportedLanguages } from '../../../_shared/index.js';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WASM_DIR = path.resolve(__dirname, '..', '..', '..', 'tree-sitter', 'wasm');

const WASM_VAR_MAP = {
  'tree-sitter-javascript.wasm': 'tree_sitter_javascript',
  'tree-sitter-typescript.wasm': 'tree_sitter_typescript',
  'tree-sitter-tsx.wasm': 'tree_sitter_tsx',
  'tree-sitter-python.wasm': 'tree_sitter_python',
  'tree-sitter-java.wasm': 'tree_sitter_java',
  'tree-sitter-c_sharp.wasm': 'tree_sitter_c_sharp',
  'tree-sitter-cpp.wasm': 'tree_sitter_cpp',
  'tree-sitter-go.wasm': 'tree_sitter_go',
  'tree-sitter-rust.wasm': 'tree_sitter_rust',
  'tree-sitter-php_only.wasm': 'tree_sitter_php_only',
  'tree-sitter-ruby.wasm': 'tree_sitter_ruby',
  'web-tree-sitter.wasm': 'web_tree_sitter',
};

const G = SupportedLanguages;

const SOURCES = {
  [G.JavaScript]:     { wasmKey: 'tree-sitter-javascript', wasmFile: 'tree-sitter-javascript.wasm' },
  [G.TypeScript]:     { wasmKey: 'tree-sitter-typescript', wasmFile: 'tree-sitter-typescript.wasm' },
  [`${G.TypeScript}:tsx`]: { wasmKey: 'tree-sitter-typescript', wasmFile: 'tree-sitter-tsx.wasm' },
  [G.Python]:         { wasmKey: 'tree-sitter-python', wasmFile: 'tree-sitter-python.wasm' },
  [G.Java]:           { wasmKey: 'tree-sitter-java', wasmFile: 'tree-sitter-java.wasm' },
  [G.CSharp]:         { wasmKey: 'tree-sitter-c-sharp', wasmFile: 'tree-sitter-c_sharp.wasm' },
  [G.CPlusPlus]:      { wasmKey: 'tree-sitter-cpp', wasmFile: 'tree-sitter-cpp.wasm' },
  [G.Go]:             { wasmKey: 'tree-sitter-go', wasmFile: 'tree-sitter-go.wasm' },
  [G.Rust]:           { wasmKey: 'tree-sitter-rust', wasmFile: 'tree-sitter-rust.wasm' },
  [G.PHP]:            { wasmKey: 'tree-sitter-php', wasmFile: 'tree-sitter-php_only.wasm' },
  [G.Ruby]:           { wasmKey: 'tree-sitter-ruby', wasmFile: 'tree-sitter-ruby.wasm' },
  [G.Vue]:            { wasmKey: 'tree-sitter-typescript', wasmFile: 'tree-sitter-typescript.wasm' },
  [G.C]:              { native: true, load: () => _require('tree-sitter-c') },
  [G.Swift]:          { native: true, load: () => _require('tree-sitter-swift') },
  [G.Dart]:           { native: true, load: () => _require('tree-sitter-dart') },
  [G.Kotlin]:         { native: true, load: () => _require('tree-sitter-kotlin') },
};

let initialized = false;
const loadResultCache = new Map();
const languageCache = new Map();

export function resolveLanguageKey(language, filePath) {
  return language === G.TypeScript && filePath?.endsWith('.tsx') ? `${language}:tsx` : language;
}

function getEmbeddedWasmPath(wasmFile) {
  const varName = WASM_VAR_MAP[wasmFile];
  if (!varName) return null;
  return path.join(WASM_DIR, `${varName}.js`);
}

async function importEmbeddedWasm(wasmFile) {
  const p = getEmbeddedWasmPath(wasmFile);
  if (!p || !fs.existsSync(p)) return null;
  try {
    const mod = await import(`file://${p.replace(/\\/g, '/')}`);
    if (mod && mod.default) {
      return Buffer.from(mod.default, 'base64');
    }
  } catch {}
  return null;
}

export async function ensureInit() {
  if (initialized) return;
  const embedded = await importEmbeddedWasm('web-tree-sitter.wasm');
  if (embedded) {
    await Parser.init({ wasmBinary: embedded });
  } else {
    await Parser.init();
  }
  initialized = true;
}

function checkWasmFileSync(source) {
  const p = getEmbeddedWasmPath(source.wasmFile);
  return p ? fs.existsSync(p) : false;
}

export function isLanguageAvailable(language, filePath) {
  const key = resolveLanguageKey(language, filePath);
  const cached = loadResultCache.get(key);
  if (cached) return cached.ok;
  const source = SOURCES[key];
  if (!source) return false;
  if (source.native) {
    try {
      const grammar = source.load();
      loadResultCache.set(key, { ok: true, grammar });
      return true;
    } catch {
      loadResultCache.set(key, { ok: false });
      return false;
    }
  }
  const available = checkWasmFileSync(source);
  if (available) {
    loadResultCache.set(key, { ok: true, grammar: null });
    return true;
  }
  loadResultCache.set(key, { ok: false });
  return false;
}

export async function loadGrammar(language, filePath) {
  const key = resolveLanguageKey(language, filePath);
  const cached = loadResultCache.get(key);
  if (cached?.ok && cached.grammar !== null) return cached.grammar;
  const source = SOURCES[key];
  if (!source) throw new Error(`Unsupported language: ${language}`);
  if (source.native) {
    const grammar = source.load();
    loadResultCache.set(key, { ok: true, grammar });
    return grammar;
  }
  await ensureInit();
  const wasmBytes = await importEmbeddedWasm(source.wasmFile);
  if (!wasmBytes) throw new Error(`WASM not found for ${language}`);
  const lang = await Language.load(wasmBytes);
  languageCache.set(key, lang);
  loadResultCache.set(key, { ok: true, grammar: lang });
  return lang;
}

export { Parser, Language };
