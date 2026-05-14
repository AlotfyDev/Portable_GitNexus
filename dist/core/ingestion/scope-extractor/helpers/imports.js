import { anchorCaptureFor } from './capture-utils.js';
export function pass3CollectImports(matches, parsedImports, provider) {
    if (provider.interpretImport === undefined)
        return;
    for (const match of matches) {
        const anchor = anchorCaptureFor(match, '@import.');
        if (anchor === undefined)
            continue;
        const parsed = provider.interpretImport(match);
        if (parsed === null)
            continue;
        parsedImports.push(parsed);
    }
}
