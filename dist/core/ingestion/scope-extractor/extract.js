import { buildPositionIndex, buildScopeTree } from '../../../_shared/index.js';
import { partitionByTopic } from './helpers/partition.js';
import { pass1BuildScopes, ensureModuleScope, draftToScope } from './helpers/scope-builder.js';
import { pass2AttachDeclarations } from './helpers/declarations.js';
import { pass3CollectImports } from './helpers/imports.js';
import { pass4CollectTypeBindings } from './helpers/type-bindings.js';
import { pass5CollectReferences } from './helpers/references.js';
export function extract(matches, filePath, provider) {
    const partitioned = partitionByTopic(matches);
    const scopeDrafts = pass1BuildScopes(partitioned.scope, filePath, provider);
    const moduleScope = ensureModuleScope(scopeDrafts, matches.length, filePath);
    const scopes = scopeDrafts.map(draftToScope);
    const scopeTree = buildScopeTree(scopes);
    const positionIndex = buildPositionIndex(scopes);
    const localDefs = [];
    pass2AttachDeclarations(partitioned.declaration, scopeDrafts, positionIndex, localDefs, filePath, provider, scopeTree);
    const parsedImports = [];
    pass3CollectImports(partitioned.import_, parsedImports, provider);
    pass4CollectTypeBindings(partitioned.typeBinding, scopeDrafts, positionIndex, filePath, provider, scopeTree);
    const referenceSites = [];
    pass5CollectReferences(partitioned.reference, positionIndex, filePath, referenceSites, provider, scopeTree);
    const frozenScopes = scopeDrafts.map(draftToScope);
    return Object.freeze({
        filePath,
        moduleScope: moduleScope.id,
        scopes: Object.freeze(frozenScopes),
        parsedImports: Object.freeze(parsedImports.slice()),
        localDefs: Object.freeze(localDefs.slice()),
        referenceSites: Object.freeze(referenceSites.slice()),
    });
}
