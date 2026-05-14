import { getLanguageFromFilename } from '../../../../_shared/index.js';
import { logger } from '../../../logger.js';
const processParsingWithWorkers = async (graph, files, symbolTable, astCache, workerPool, onFileProgress) => {
    const parseableFiles = [];
    for (const file of files) {
        const lang = getLanguageFromFilename(file.path);
        if (lang)
            parseableFiles.push({ path: file.path, content: file.content });
    }
    if (parseableFiles.length === 0)
        return {
            imports: [],
            calls: [],
            assignments: [],
            heritage: [],
            routes: [],
            fetchCalls: [],
            decoratorRoutes: [],
            toolDefs: [],
            ormQueries: [],
            constructorBindings: [],
            fileScopeBindings: [],
            parsedFiles: [],
        };
    const total = files.length;
    const chunkResults = await workerPool.dispatch(parseableFiles, (filesProcessed) => {
        onFileProgress?.(Math.min(filesProcessed, total), total, 'Parsing...');
    });
    const allImports = [];
    const allCalls = [];
    const allAssignments = [];
    const allHeritage = [];
    const allRoutes = [];
    const allFetchCalls = [];
    const allDecoratorRoutes = [];
    const allToolDefs = [];
    const allORMQueries = [];
    const allConstructorBindings = [];
    const fileScopeBindingsByFile = [];
    const allParsedFiles = [];
    for (const result of chunkResults) {
        for (const node of result.nodes) {
            graph.addNode({
                id: node.id,
                label: node.label,
                properties: node.properties,
            });
        }
        for (const rel of result.relationships) {
            graph.addRelationship(rel);
        }
        for (const sym of result.symbols) {
            symbolTable.add(sym.filePath, sym.name, sym.nodeId, sym.type, {
                parameterCount: sym.parameterCount,
                requiredParameterCount: sym.requiredParameterCount,
                parameterTypes: sym.parameterTypes,
                returnType: sym.returnType,
                declaredType: sym.declaredType,
                ownerId: sym.ownerId,
                qualifiedName: sym.qualifiedName,
            });
        }
        for (const item of result.imports)
            allImports.push(item);
        for (const item of result.calls)
            allCalls.push(item);
        for (const item of result.assignments)
            allAssignments.push(item);
        for (const item of result.heritage)
            allHeritage.push(item);
        for (const item of result.routes)
            allRoutes.push(item);
        for (const item of result.fetchCalls)
            allFetchCalls.push(item);
        for (const item of result.decoratorRoutes)
            allDecoratorRoutes.push(item);
        for (const item of result.toolDefs)
            allToolDefs.push(item);
        if (result.ormQueries)
            for (const item of result.ormQueries)
                allORMQueries.push(item);
        for (const item of result.constructorBindings)
            allConstructorBindings.push(item);
        if (result.fileScopeBindings)
            for (const item of result.fileScopeBindings)
                fileScopeBindingsByFile.push(item);
        if (result.parsedFiles)
            for (const item of result.parsedFiles)
                allParsedFiles.push(item);
    }
    const skippedLanguages = new Map();
    for (const result of chunkResults) {
        for (const [lang, count] of Object.entries(result.skippedLanguages)) {
            skippedLanguages.set(lang, (skippedLanguages.get(lang) || 0) + count);
        }
    }
    if (skippedLanguages.size > 0) {
        const summary = Array.from(skippedLanguages.entries())
            .map(([lang, count]) => `${lang}: ${count}`)
            .join(', ');
        logger.warn(`  Skipped unsupported languages: ${summary}`);
    }
    onFileProgress?.(total, total, 'done');
    return {
        imports: allImports,
        calls: allCalls,
        assignments: allAssignments,
        heritage: allHeritage,
        routes: allRoutes,
        fetchCalls: allFetchCalls,
        decoratorRoutes: allDecoratorRoutes,
        toolDefs: allToolDefs,
        ormQueries: allORMQueries,
        constructorBindings: allConstructorBindings,
        fileScopeBindings: fileScopeBindingsByFile,
        parsedFiles: allParsedFiles,
    };
};
export { processParsingWithWorkers };
