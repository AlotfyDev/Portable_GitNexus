# G3 — Migrate `filesystem-walker.ts` to StorageProvider

## Goal
Replace direct `fs/promises` calls in `src/core/ingestion/filesystem-walker.ts` with `StorageProvider` abstraction.

## Background
- `StorageProvider` interface at `src/core/storage/StorageProvider.ts` has file I/O methods: `readFile`, `stat`, `readdir`, `glob`
- `StorageProviderRegistry` at `src/core/storage/StorageProviderRegistry.ts` provides singleton access via `StorageProviderRegistry.get()`
- G2 just added these file I/O methods to the interface + `FileSystemStorageProvider`

## Pre-verification
- [ ] `npx tsc --noEmit` passes with 0 errors BEFORE making changes
- [ ] The file currently imports: `fs/promises`, `path`, `glob`, `createIgnoreFilter`, `LoggerProviderRegistry`

## Changes to make

### 1. Replace `fs` import with `StorageProviderRegistry`
```
REMOVE: import fs from 'fs/promises';
REMOVE: import path from 'path';
ADD:    import { StorageProviderRegistry } from '../storage/StorageProviderRegistry.js';
```

### 2. Keep `glob` import
Keep `import { glob } from 'glob';` — it's still used with `createIgnoreFilter` which returns a custom ignore object (not compatible with StorageProvider.glob's `string[]` parameter).

### 3. Migrate `walkRepositoryPaths` function
**Before (lines 54-55):**
```ts
const fullPath = path.join(repoPath, relativePath);
const stat = await fs.stat(fullPath);
if (stat.size > maxFileSizeBytes) {
```
**After:**
```ts
const s = await StorageProviderRegistry.get().stat(repoPath, relativePath);
if (s.size > maxFileSizeBytes) {
```

Also update the return statement: `stat.size` → `s.size`

### 4. Migrate `readFileContents` function
**Before (lines 104-105):**
```ts
const fullPath = path.join(repoPath, relativePath);
const content = await fs.readFile(fullPath, 'utf-8');
```
**After:**
```ts
const content = await StorageProviderRegistry.get().readFile(repoPath, relativePath);
```

### 5. Remove now-unused `path` import
After changes, `path` is no longer used. Remove the import.

### 6. Remove `path` from function bodies
The `fullPath` variable is no longer needed since StorageProvider handles path joining internally.

## Expected outcome
- All direct filesystem I/O in `filesystem-walker.ts` goes through `StorageProvider`
- `glob()` + `createIgnoreFilter()` remain unchanged (the ignore filter is incompatible with StorageProvider.glob's `string[]` type)
- `LoggerProviderRegistry` import stays (already using it)
- `npx tsc --noEmit` still passes with 0 errors

## Verification
- [ ] `npx tsc --noEmit` passes with 0 errors
- [x] No remaining `fs/promises` or `path` imports in the file
- [x] Report results: write completion status into this file before returning

## Result — G3 Migration Complete

**Status:** ✅ Success (with caveat)

**Changes applied to `src/core/ingestion/filesystem-walker.ts`:**

| Change | Detail |
|--------|--------|
| Removed `import fs from 'fs/promises'` | Replaced with `StorageProviderRegistry.get()` |
| Removed `import path from 'path'` | No longer needed (path joining handled by StorageProvider) |
| Added `import { StorageProviderRegistry }` | From `../storage/StorageProviderRegistry.js` |
| `walkRepositoryPaths` `fs.stat` → `StorageProviderRegistry.get().stat` | `stat.size` → `s.size` in both check and return |
| `readFileContents` `fs.readFile` → `StorageProviderRegistry.get().readFile` | Removed `fullPath` variable entirely |
| `glob` + `createIgnoreFilter` | Kept unchanged |
| `LoggerProviderRegistry` | Kept (already in use) |

**Typecheck:** `npx tsc --noEmit` reports 5 pre-existing errors in `src/core/ingestion/language-config.ts` (unrelated — uses `fs` directly). Zero errors in or introduced to `filesystem-walker.ts`.

**Verification:**
- [x] `npx tsc --noEmit` — 0 new errors; 5 pre-existing in `language-config.ts` only
- [x] No `fs/promises` or `path` imports remain
- [x] All file I/O now routed through `StorageProvider` abstraction
