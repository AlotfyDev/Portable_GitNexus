/**
 * C# import resolution config.
 * Namespace-based strategy via .csproj configs, then standard fallback.
 */
import { SupportedLanguages } from '../../../../_shared/index.js';
import { createStandardStrategy } from '../standard.js';
import { resolveCSharpImportInternal, resolveCSharpNamespaceDir } from '../csharp.js';
/** C# namespace-based resolution strategy via .csproj configs. */
export const csharpNamespaceStrategy = (rawImportPath, _filePath, ctx) => {
    const csharpConfigs = ctx.configs.csharpConfigs;
    if (csharpConfigs.length > 0) {
        const resolvedFiles = resolveCSharpImportInternal(rawImportPath, csharpConfigs, ctx.normalizedFileList, ctx.allFileList, ctx.index);
        if (resolvedFiles.length > 1) {
            const dirSuffix = resolveCSharpNamespaceDir(rawImportPath, csharpConfigs);
            if (dirSuffix) {
                return { kind: 'package', files: resolvedFiles, dirSuffix };
            }
        }
        if (resolvedFiles.length > 0)
            return { kind: 'files', files: resolvedFiles };
    }
    return null;
};
export const csharpImportConfig = {
    language: SupportedLanguages.CSharp,
    strategies: [csharpNamespaceStrategy, createStandardStrategy(SupportedLanguages.CSharp)],
};
