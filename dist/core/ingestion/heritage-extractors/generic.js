// gitnexus/src/core/ingestion/heritage-extractors/generic.ts
/**
 * Create a HeritageExtractor from a declarative config or a language enum.
 *
 * When a full HeritageExtractionConfig is provided, custom hooks
 * (shouldSkipExtends, callBasedHeritage) drive the extraction.
 * When only a SupportedLanguages value is provided, the factory produces
 * a default extractor that handles the standard @heritage.* captures.
 */
export function createHeritageExtractor(config) {
    const actualConfig = typeof config === 'string' ? { language: config } : config;
    const callNameSet = actualConfig.callBasedHeritage?.callNames;
    return {
        language: actualConfig.language,
        extract(captureMap, context) {
            const classNode = captureMap['heritage.class'];
            if (!classNode)
                return [];
            const className = classNode.text;
            const results = [];
            const extendsNode = captureMap['heritage.extends'];
            if (extendsNode) {
                if (!actualConfig.shouldSkipExtends?.(extendsNode)) {
                    results.push({ className, parentName: extendsNode.text, kind: 'extends' });
                }
            }
            const implementsNode = captureMap['heritage.implements'];
            if (implementsNode) {
                results.push({ className, parentName: implementsNode.text, kind: 'implements' });
            }
            const traitNode = captureMap['heritage.trait'];
            if (traitNode) {
                results.push({ className, parentName: traitNode.text, kind: 'trait-impl' });
            }
            return results;
        },
        ...(callNameSet
            ? {
                extractFromCall(calledName, callNode, context) {
                    if (!callNameSet.has(calledName))
                        return null;
                    return actualConfig.callBasedHeritage.extract(calledName, callNode, context.filePath);
                },
            }
            : {}),
    };
}
