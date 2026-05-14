// Build script for portable GitNexus binary
// Uses Bun.build() programmatically with plugins for WASM inlining and native module stubs
// Usage: bun run scripts/build-portable.mjs

import { readFileSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Plugin: inline WASM base64 + stub native modules ────────────────────

const wasmPlugin = {
  name: 'gitnexus-standalone',
  setup(build) {
    // ── Stub native-only / optional packages ────────────────────────
    const stubModules = [
      { specifier: /@ladybugdb/, id: 'lbug-stub' },
      { specifier: /onnxruntime-node/, id: 'ort-stub' },
      { specifier: /onnxruntime-common/, id: 'ort-stub' },
      { specifier: /onnxruntime-web/, id: 'ort-stub' },
      // tree-sitter-* grammar packages — stub to prevent native .node loading
      { specifier: /^tree-sitter-/, id: 'grammar-stub' },
      // @huggingface/transformers — pure JS, bundles fine (no stub needed)
    ];

    for (const { specifier, id } of stubModules) {
      build.onResolve({ filter: specifier }, (args) => {
        return { path: id + ':' + args.path, namespace: id };
      });
    }

    // Redirect tree-sitter base package → web-tree-sitter wrapper
    // web-tree-sitter has named exports only (no default), but code does `import Parser from 'tree-sitter'`
    build.onResolve({ filter: /^tree-sitter$/ }, (args) => {
      try {
        const wtsPath = Bun.resolveSync('web-tree-sitter', args.resolveDir);
        return { path: 'ts-redirect:' + wtsPath, namespace: 'ts-redirect' };
      } catch {
        return { path: 'ts-stub:' + args.path, namespace: 'ts-stub' };
      }
    });

    // @ladybugdb/core stub
    build.onLoad({ filter: /^lbug-stub:/, namespace: 'lbug-stub' }, () => ({
      contents: `
const _err = () => { throw new Error('@ladybugdb/core native addon not available in portable binary'); };
const Database = class Database { constructor() { _err(); } };
export { Database };
export default Database;
export const connect = _err;
export const init = _err;
export const close = _err;`,
      loader: 'js',
    }));

    // onnxruntime stubs — match the API shape that @huggingface/transformers expects
    build.onLoad({ filter: /^ort-stub:/, namespace: 'ort-stub' }, () => ({
      contents: `
// Stub for onnxruntime native addon in portable binary
const ort = {
  Tensor: class Tensor { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } },
  InferenceSession: { create: async () => { throw new Error('ONNX Runtime native addon not available in portable binary'); } },
  env: { wasm: { numThreads: 1 } },
};
export default ort;
export const Tensor = ort.Tensor;
export const InferenceSession = ort.InferenceSession;
export const env = ort.env;`,
      loader: 'js',
    }));

    // tree-sitter-* grammar stubs — prevent native .node loading from grammar packages
    build.onLoad({ filter: /^grammar-stub:/, namespace: 'grammar-stub' }, () => ({
      contents: `module.exports = {};`,
      loader: 'js',
    }));

    // Redirect: tree-sitter → web-tree-sitter (read file + add default export)
    build.onLoad({ filter: /^ts-redirect:/, namespace: 'ts-redirect' }, (args) => {
      const actualPath = args.path.replace(/^ts-redirect:/, '');
      const original = readFileSync(actualPath, 'utf-8');
      return {
        contents: `
// Redirect: tree-sitter → web-tree-sitter (wrapped with default export)
${original}
export { Parser as default };`,
        loader: 'js',
      };
    });

    // Fallback tree-sitter stub (if web-tree-sitter not found)
    build.onLoad({ filter: /^ts-stub:/, namespace: 'ts-stub' }, () => ({
      contents: `
const Parser = class Parser { constructor() { throw new Error('tree-sitter not available in portable binary'); } };
export { Parser };
export default Parser;`,
      loader: 'js',
    }));

  },
};

// ─── Bundle step ──────────────────────────────────────────────────────────

const entry = resolve(ROOT, 'dist/cli/index.js');
const bundleOut = resolve(ROOT, 'dist-bun/gitnexus-bundled.js');
const finalBinary = resolve(ROOT, 'gitnexus-portable-final.exe');

console.log('▶ Step 1: Bundling with plugins...');
console.log('   Entry:', entry);

const result = await Bun.build({
  entrypoints: [entry],
  outdir: resolve(ROOT, 'dist-bun'),
  naming: 'gitnexus-bundled.js',
  target: 'bun',
  plugins: [wasmPlugin],
  // Native/optional modules are stubbed by the plugin above.
  // No need for --external — the plugin handles them at the resolve level.
  external: [],
});

if (!result.success) {
  console.error('✗ Bundle failed:');
  for (const err of result.logs) {
    console.error(' ', err);
  }
  process.exit(1);
}

const bundleSize = existsSync(resolve(ROOT, 'dist-bun/gitnexus-bundled.js'))
  ? readFileSync(resolve(ROOT, 'dist-bun/gitnexus-bundled.js')).length
  : 0;
console.log(`✔ Bundle success: ${result.outputs.length} output(s), ${(bundleSize / 1024 / 1024).toFixed(1)} MB`);

// ─── Compile step ─────────────────────────────────────────────────────────

const bundleFile = resolve(ROOT, 'dist-bun/gitnexus-bundled.js');
console.log('\n▶ Step 2: Compiling standalone binary...');
console.log('   Output:', finalBinary);

// Clean previous build
try { rmSync(finalBinary, { force: true }); } catch {}

const compileResult = Bun.spawnSync([
  process.execPath,
  'build',
  '--compile',
  bundleFile,
  '--outfile', finalBinary,
  '--target', 'bun',
], {
  cwd: ROOT,
  env: { ...process.env },
});

if (compileResult.exitCode !== 0) {
  console.error('✗ Compile failed:', compileResult.stderr.toString());
  process.exit(1);
}

console.log('✔ Compile success');

// ─── Report ───────────────────────────────────────────────────────────────

const binStat = existsSync(finalBinary) ? readFileSync(finalBinary).length : 0;
console.log(`\n✔ Binary: ${finalBinary} (${(binStat / 1024 / 1024).toFixed(1)} MB)`);
