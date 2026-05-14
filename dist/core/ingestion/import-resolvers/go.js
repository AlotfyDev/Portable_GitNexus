/**
 * Go package import resolution — internal helpers.
 *
 * Strategy lives in configs/go.ts.
 * This file contains the shared helpers used by the strategy.
 */
/**
 * Extract the package directory suffix from a Go import path.
 * Returns the suffix string (e.g., "/internal/auth/") or null if invalid.
 */
export function resolveGoPackageDir(importPath, goModule) {
    if (!importPath.startsWith(goModule.modulePath))
        return null;
    const relativePkg = importPath.slice(goModule.modulePath.length + 1);
    if (!relativePkg)
        return null;
    return '/' + relativePkg + '/';
}
/**
 * Resolve a Go internal package import to all .go files in the package directory.
 * Returns an array of file paths.
 */
export function resolveGoPackage(importPath, goModule, normalizedFileList, allFileList) {
    if (!importPath.startsWith(goModule.modulePath))
        return [];
    // Strip module path to get relative package path
    const relativePkg = importPath.slice(goModule.modulePath.length + 1); // e.g., "internal/auth"
    if (!relativePkg)
        return [];
    const pkgSuffix = '/' + relativePkg + '/';
    const matches = [];
    for (let i = 0; i < normalizedFileList.length; i++) {
        // Prepend '/' so paths like "internal/auth/service.go" match suffix "/internal/auth/"
        const normalized = '/' + normalizedFileList[i];
        // File must be directly in the package directory (not a subdirectory)
        if (normalized.includes(pkgSuffix) &&
            normalized.endsWith('.go') &&
            !normalized.endsWith('_test.go')) {
            const afterPkg = normalized.substring(normalized.indexOf(pkgSuffix) + pkgSuffix.length);
            if (!afterPkg.includes('/')) {
                matches.push(allFileList[i]);
            }
        }
    }
    return matches;
}
