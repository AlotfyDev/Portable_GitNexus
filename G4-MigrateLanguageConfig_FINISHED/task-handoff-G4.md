# G4 — Migrate `language-config.ts` to StorageProvider

## Goal
Replace direct `fs/promises` calls in `src/core/ingestion/language-config.ts` with `StorageProvider` abstraction.

## Background
- `StorageProvider` interface at `src/core/storage/StorageProvider.ts` has file I/O methods: `readFile`, `stat`, `readdir`, `glob`
- `StorageProviderRegistry` at `src/core/storage/StorageProviderRegistry.ts` provides singleton access via `StorageProviderRegistry.get()`
- G2 just added these file I/O methods to the interface + `FileSystemStorageProvider`

## Pre-verification
- [ ] The file currently imports: `fs/promises`, `path`, `ImportConfigs`, `isDev`, `LoggerProviderRegistry`

## Changes to make

### 1. Replace `fs` import with `StorageProviderRegistry`
```
REMOVE: import fs from 'fs/promises';
ADD:    import { StorageProviderRegistry } from '../storage/StorageProviderRegistry.js';
```

### 2. Keep `path` import
`path` is still used for `path.join(...)` and `path.relative(...)` throughout.

### 3. Migrate `loadTsconfigPaths` (lines 58-97)
**Before (line 64):**
```ts
const raw = await fs.readFile(tsconfigPath, 'utf-8');
```
**After:**
```ts
const raw = await StorageProviderRegistry.get().readFile(repoRoot, filename);
```
(Remove the `tsconfigPath` variable since `path.join(repoRoot, filename)` is now inside StorageProvider.)

### 4. Migrate `loadGoModulePath` (lines 102-117)
**Before (line 105):**
```ts
const content = await fs.readFile(goModPath, 'utf-8');
```
**After:**
```ts
const content = await StorageProviderRegistry.get().readFile(repoRoot, 'go.mod');
```
(Remove `goModPath` variable.)

### 5. Migrate `loadComposerConfig` (lines 120-143)
**Before (line 123):**
```ts
const raw = await fs.readFile(composerPath, 'utf-8');
```
**After:**
```ts
const raw = await StorageProviderRegistry.get().readFile(repoRoot, 'composer.json');
```
(Remove `composerPath` variable.)

### 6. Migrate `loadCSharpProjectConfig` (lines 149-197)
This is the most complex migration because `readdir` with `withFileTypes` is used.

**Before (line 161):**
```ts
const entries = await fs.readdir(dir, { withFileTypes: true });
```
`dir` is an absolute path. We need to track relative path from repoRoot.

**Strategy:**
- Keep a `dirRelative` variable alongside `dir` (or instead of `dir`)
- Use `StorageProviderRegistry.get().readdir(repoRoot, dirRelative)` which returns `string[]`
- After getting entry names, use `StorageProviderRegistry.get().stat(repoRoot, path.join(dirRelative, name))` to check `isDirectory`/`isFile`

**Changes:**
- Change `scanQueue` from `{ dir: string; depth: number }[]` to `{ dirRelative: string; depth: number }[]`
- Initialize with `{ dirRelative: '.', depth: 0 }`
- Use `StorageProviderRegistry.get().readdir(repoRoot, dirRelative)` instead of `fs.readdir(dir, { withFileTypes: true })`
- For each entry, check isDirectory by statting:
```ts
const entries = await StorageProviderRegistry.get().readdir(repoRoot, dirRelative);
for (const name of entries) {
  const entryRel = path.posix ? path.posix.join(dirRelative, name) : path.join(dirRelative, name).replace(/\\/g, '/');
  const s = await StorageProviderRegistry.get().stat(repoRoot, entryRel);
  if (s.isDirectory && depth < maxDepth) {
    // skip node_modules, .git, bin, obj
    if (['node_modules', '.git', 'bin', 'obj'].includes(name)) continue;
    scanQueue.push({ dirRelative: entryRel, depth: depth + 1 });
  }
  if (s.isFile && name.endsWith('.csproj')) {
    const content = await StorageProviderRegistry.get().readFile(repoRoot, entryRel);
    // ... rest same but use entryRel for projectDir calculation
  }
}
```

- **Important**: `StorageProvider.readdir()` returns entry names like `fs.readdir(dir)` without `withFileTypes`. So `entry.name` → just `name`.

### 7. Migrate `loadSwiftPackageConfig` (lines 199-227)
**Before (line 209):**
```ts
const entries = await fs.readdir(fullPath, { withFileTypes: true });
```
**After:**
```ts
const entries = await StorageProviderRegistry.get().readdir(repoRoot, sourceDir);
for (const name of entries) {
  const relPath = sourceDir + '/' + name;
  const s = await StorageProviderRegistry.get().stat(repoRoot, relPath);
  if (s.isDirectory) {
    targets.set(name, sourceDir + '/' + name);
  }
}
```
(Remove `fullPath` variable, remove `{ withFileTypes: true }` parameter.)

### 8. Handle `fs.readFile` for `.csproj` files (inside the BFS loop in loadCSharpProjectConfig)
**Before (line 177):**
```ts
const content = await fs.readFile(csprojPath, 'utf-8');
```
**After:**
```ts
const content = await StorageProviderRegistry.get().readFile(repoRoot, entryRel);
```
(Where `entryRel` is the relative path to the csproj file.)

## Expected outcome
- All direct filesystem I/O in `language-config.ts` goes through `StorageProvider`
- `path` import remains for path.join/path.relative (these are not I/O)
- `LoggerProviderRegistry` import stays (already using it)
- `npx tsc --noEmit` still passes with 0 errors

## Verification
- [x] `npx tsc --noEmit` passes with 0 errors
- [x] No remaining `fs/promises` import in the file
- [x] All `fs.readFile` → `StorageProviderRegistry.get().readFile`
- [x] All `fs.readdir` → `StorageProviderRegistry.get().readdir` (with stat for type checking)
- [x] Report results: write completion status into this file before returning

## Result

**Status: SUCCESS**

**Summary of changes to `src/core/ingestion/language-config.ts`:**

1. **Import change**: Removed `import fs from 'fs/promises'`; added `import { StorageProviderRegistry } from '../storage/StorageProviderRegistry.js'`; kept `import path from 'path'`.

2. **`loadTsconfigPaths`**: Replaced `fs.readFile(tsconfigPath, 'utf-8')` with `StorageProviderRegistry.get().readFile(repoRoot, filename)`. Removed `tsconfigPath = path.join(repoRoot, filename)` variable.

3. **`loadGoModulePath`**: Replaced `fs.readFile(goModPath, 'utf-8')` with `StorageProviderRegistry.get().readFile(repoRoot, 'go.mod')`. Removed `goModPath` variable.

4. **`loadComposerConfig`**: Replaced `fs.readFile(composerPath, 'utf-8')` with `StorageProviderRegistry.get().readFile(repoRoot, 'composer.json')`. Removed `composerPath` variable.

5. **`loadCSharpProjectConfig`**: Migrated BFS from absolute `{ dir, depth }` to relative `{ dirRelative, depth }` paths. Changed `fs.readdir(dir, { withFileTypes: true })` → `StorageProviderRegistry.get().readdir(repoRoot, dirRelative)` returning `string[]`, using `stat()` to check `isDirectory`/`isFile` per entry. Changed `fs.readFile(csprojPath, 'utf-8')` → `StorageProviderRegistry.get().readFile(repoRoot, entryRel)`. `projectDir` computed from `dirRelative` instead of `path.relative(repoRoot, dir)`.

6. **`loadSwiftPackageConfig`**: Removed `fullPath` variable. Changed `fs.readdir(fullPath, { withFileTypes: true })` → `StorageProviderRegistry.get().readdir(repoRoot, sourceDir)` with `stat()` per entry to check `isDirectory`.

**File**: `src/core/ingestion/language-config.ts` (241 lines, -1 net)
**Typecheck**: `npx tsc --noEmit` — 0 errors
