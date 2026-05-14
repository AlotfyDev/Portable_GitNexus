import { FUNCTION_NODE_TYPES, CLASS_CONTAINER_TYPES, genericFuncName, } from '../utils/ast-helpers.js';
import { TYPED_PARAMETER_TYPES, extractVarName, extractReturnTypeName } from '../type-extractors/shared.js';
import { getProvider } from '../languages/index.js';
import { FILE_SCOPE, SKIP_SUBTREE_TYPES } from './constants.js';
import { emptyFileScope, findNarrowingBranchScope, lookupInEnv } from './helpers/scope-lookup.js';
import { clearClassNameCaches, createClassNameLookup, findTypeIdentifierChild, extractConstructorTypeName } from './helpers/class-lookup.js';
import { substituteThisReceiver } from './helpers/substitute-this.js';
import { resolveFixpointBindings } from './helpers/fixpoint.js';
import { seedImportedBindings } from './seed-imports.js';
export const buildTypeEnv = (tree, language, options) => {
    clearClassNameCaches();
    const model = options?.model;
    const parentMap = options?.parentMap;
    const extractFuncNameHook = options?.extractFunctionName;
    const env = new Map();
    let flushed = false;
    const patternOverrides = new Map();
    const constructorTypeMap = new Map();
    const localClassNames = new Set();
    const classNames = createClassNameLookup(localClassNames, model);
    const provider = getProvider(language);
    const config = provider.typeConfig;
    const bindings = [];
    const getCallableUnionCount = (m, callee) => {
        return (m.symbols.lookupCallableByName(callee).length + m.methods.lookupMethodByName(callee).length);
    };
    const getFirstCallable = (m, callee) => {
        const free = m.symbols.lookupCallableByName(callee);
        if (free.length > 0)
            return free[0];
        const methods = m.methods.lookupMethodByName(callee);
        return methods.length > 0 ? methods[0] : undefined;
    };
    const returnTypeLookup = {
        lookupReturnType(callee) {
            if (model) {
                if (provider.isBuiltInName(callee))
                    return undefined;
                const count = getCallableUnionCount(model, callee);
                if (count === 1) {
                    const rawReturn = getFirstCallable(model, callee)?.returnType;
                    if (rawReturn)
                        return extractReturnTypeName(rawReturn);
                }
                if (count > 1)
                    return undefined;
            }
            return options?.importedReturnTypes?.get(callee);
        },
        lookupRawReturnType(callee) {
            if (model) {
                if (provider.isBuiltInName(callee))
                    return undefined;
                const count = getCallableUnionCount(model, callee);
                if (count === 1)
                    return getFirstCallable(model, callee)?.returnType;
                if (count > 1)
                    return undefined;
            }
            return options?.importedRawReturnTypes?.get(callee);
        },
    };
    const interestingNodeTypes = new Set();
    TYPED_PARAMETER_TYPES.forEach((t) => interestingNodeTypes.add(t));
    config.declarationNodeTypes.forEach((t) => interestingNodeTypes.add(t));
    config.forLoopNodeTypes?.forEach((t) => interestingNodeTypes.add(t));
    const pendingItems = [];
    const pendingForLoops = [];
    const declarationTypeNodes = new Map();
    const extractTypeBinding = (node, scopeEnv, scope) => {
        if (TYPED_PARAMETER_TYPES.has(node.type)) {
            const typeNode = node.childForFieldName('type');
            if (typeNode) {
                const nameNode = node.childForFieldName('name') ??
                    node.childForFieldName('pattern') ??
                    (node.firstNamedChild?.type === 'identifier' ? node.firstNamedChild : null);
                if (nameNode) {
                    const varName = extractVarName(nameNode);
                    if (varName && !declarationTypeNodes.has(`${scope}\0${varName}`)) {
                        declarationTypeNodes.set(`${scope}\0${varName}`, typeNode);
                    }
                }
            }
            else {
                let fallbackName = null;
                let fallbackType = null;
                for (let i = 0; i < node.namedChildCount; i++) {
                    const child = node.namedChild(i);
                    if (!child)
                        continue;
                    if (!fallbackName &&
                        (child.type === 'simple_identifier' || child.type === 'identifier')) {
                        fallbackName = child;
                    }
                    if (!fallbackType &&
                        (child.type === 'user_type' ||
                            child.type === 'type_identifier' ||
                            child.type === 'generic_type' ||
                            child.type === 'parameterized_type' ||
                            child.type === 'nullable_type')) {
                        fallbackType = child;
                    }
                }
                if (fallbackName && fallbackType) {
                    const varName = extractVarName(fallbackName);
                    if (varName && !declarationTypeNodes.has(`${scope}\0${varName}`)) {
                        declarationTypeNodes.set(`${scope}\0${varName}`, fallbackType);
                    }
                }
            }
            config.extractParameter(node, scopeEnv);
            return;
        }
        if (config.forLoopNodeTypes?.has(node.type)) {
            if (config.extractForLoopBinding) {
                const sizeBefore = scopeEnv.size;
                const forLoopCtx = {
                    scopeEnv,
                    declarationTypeNodes,
                    scope,
                    returnTypeLookup,
                };
                config.extractForLoopBinding(node, forLoopCtx);
                if (scopeEnv.size === sizeBefore) {
                    pendingForLoops.push({ node, scope });
                }
            }
            return;
        }
        if (config.declarationNodeTypes.has(node.type)) {
            let typeNode = config.getDeclarationTypeNode?.(node) ?? node.childForFieldName('type') ?? null;
            if (!typeNode) {
                for (let i = 0; i < node.namedChildCount; i++) {
                    const c = node.namedChild(i);
                    if (c?.type === 'type_annotation') {
                        typeNode = c.firstNamedChild ?? c;
                        break;
                    }
                }
            }
            if (typeNode) {
                const nameNode = node.childForFieldName('name') ??
                    node.childForFieldName('left') ??
                    node.childForFieldName('pattern');
                if (nameNode) {
                    const varName = extractVarName(nameNode);
                    if (varName && !declarationTypeNodes.has(`${scope}\0${varName}`)) {
                        declarationTypeNodes.set(`${scope}\0${varName}`, typeNode);
                    }
                }
            }
            const sizeBefore = typeNode ? scopeEnv.size : -1;
            config.extractDeclaration(node, scopeEnv);
            if (sizeBefore >= 0 && scopeEnv.size > sizeBefore) {
                let skip = sizeBefore;
                for (const varName of scopeEnv.keys()) {
                    if (skip > 0) {
                        skip--;
                        continue;
                    }
                    if (!declarationTypeNodes.has(`${scope}\0${varName}`)) {
                        declarationTypeNodes.set(`${scope}\0${varName}`, typeNode);
                    }
                }
            }
            if (config.extractInitializer) {
                config.extractInitializer(node, scopeEnv, classNames);
            }
            if (sizeBefore >= 0 && scopeEnv.size > sizeBefore) {
                let ctorSkip = sizeBefore;
                for (const varName of scopeEnv.keys()) {
                    if (ctorSkip > 0) {
                        ctorSkip--;
                        continue;
                    }
                    const declaredType = scopeEnv.get(varName);
                    if (!declaredType)
                        continue;
                    const ctorType = extractConstructorTypeName(node) ?? config.detectConstructorType?.(node, classNames);
                    if (!ctorType || ctorType === declaredType)
                        continue;
                    const declTypeNode = declarationTypeNodes.get(`${scope}\0${varName}`);
                    const effectiveDeclaredType = declTypeNode && config.unwrapDeclaredType
                        ? (config.unwrapDeclaredType(declaredType, declTypeNode) ?? declaredType)
                        : declaredType;
                    if (ctorType !== effectiveDeclaredType) {
                        constructorTypeMap.set(`${scope}\0${varName}`, ctorType);
                    }
                }
            }
        }
    };
    const stack = [
        { node: tree.rootNode, scope: FILE_SCOPE },
    ];
    const processNode = (node, currentScope) => {
        if (SKIP_SUBTREE_TYPES.has(node.type))
            return;
        if (CLASS_CONTAINER_TYPES.has(node.type)) {
            const nameNode = node.childForFieldName('name') ?? findTypeIdentifierChild(node);
            if (nameNode)
                localClassNames.add(nameNode.text);
        }
        let scope = currentScope;
        if (FUNCTION_NODE_TYPES.has(node.type)) {
            const funcName = extractFuncNameHook?.(node)?.funcName ?? genericFuncName(node);
            if (funcName)
                scope = `${funcName}@${node.startIndex}`;
        }
        if (interestingNodeTypes.has(node.type)) {
            if (!env.has(scope))
                env.set(scope, new Map());
            const scopeEnv = env.get(scope);
            extractTypeBinding(node, scopeEnv, scope);
        }
        if (config.extractPatternBinding &&
            (!config.patternBindingNodeTypes || config.patternBindingNodeTypes.has(node.type))) {
            if (!env.has(scope))
                env.set(scope, new Map());
            const scopeEnv = env.get(scope);
            const patternBinding = config.extractPatternBinding(node, scopeEnv, declarationTypeNodes, scope);
            if (patternBinding) {
                if (patternBinding.narrowingRange) {
                    if (!patternOverrides.has(scope))
                        patternOverrides.set(scope, new Map());
                    const varMap = patternOverrides.get(scope);
                    if (!varMap.has(patternBinding.varName))
                        varMap.set(patternBinding.varName, []);
                    varMap.get(patternBinding.varName).push({
                        rangeStart: patternBinding.narrowingRange.startIndex,
                        rangeEnd: patternBinding.narrowingRange.endIndex,
                        typeName: patternBinding.typeName,
                    });
                }
                else if (config.allowPatternBindingOverwrite) {
                    const branchNode = findNarrowingBranchScope(node);
                    if (branchNode) {
                        if (!patternOverrides.has(scope))
                            patternOverrides.set(scope, new Map());
                        const varMap = patternOverrides.get(scope);
                        if (!varMap.has(patternBinding.varName))
                            varMap.set(patternBinding.varName, []);
                        varMap.get(patternBinding.varName).push({
                            rangeStart: branchNode.startIndex,
                            rangeEnd: branchNode.endIndex,
                            typeName: patternBinding.typeName,
                        });
                    }
                    scopeEnv.set(patternBinding.varName, patternBinding.typeName);
                }
                else if (!scopeEnv.has(patternBinding.varName)) {
                    scopeEnv.set(patternBinding.varName, patternBinding.typeName);
                }
            }
        }
        if (config.extractPendingAssignment && config.declarationNodeTypes.has(node.type)) {
            const scopeEnv = env.get(scope);
            if (scopeEnv) {
                const pending = config.extractPendingAssignment(node, scopeEnv);
                if (pending) {
                    const items = Array.isArray(pending) ? pending : [pending];
                    for (const item of items) {
                        const resolved = substituteThisReceiver(item, node);
                        pendingItems.push({ scope, ...resolved });
                    }
                }
            }
        }
        if (config.scanConstructorBinding) {
            const result = config.scanConstructorBinding(node);
            if (result) {
                const scopeEnv = env.get(scope);
                if (!scopeEnv?.has(result.varName)) {
                    bindings.push({ scope, ...result });
                }
            }
        }
        for (let i = node.childCount - 1; i >= 0; i--) {
            const child = node.child(i);
            if (child)
                stack.push({ node: child, scope });
        }
    };
    while (stack.length > 0) {
        const { node, scope } = stack.pop();
        processNode(node, scope);
    }
    if (options?.importedBindings && options.importedBindings.size > 0) {
        seedImportedBindings(env, options.importedBindings);
    }
    resolveFixpointBindings(pendingItems, env, returnTypeLookup, model, parentMap);
    if (pendingForLoops.length > 0 && config.extractForLoopBinding) {
        for (const { node, scope } of pendingForLoops) {
            if (!env.has(scope))
                env.set(scope, new Map());
            const scopeEnv = env.get(scope);
            config.extractForLoopBinding(node, {
                scopeEnv,
                declarationTypeNodes,
                scope,
                returnTypeLookup,
            });
        }
        const unresolvedBefore = pendingItems.filter((item) => {
            const scopeEnv = env.get(item.scope);
            return scopeEnv && !scopeEnv.has(item.lhs);
        });
        if (unresolvedBefore.length > 0) {
            resolveFixpointBindings(unresolvedBefore, env, returnTypeLookup, model);
        }
    }
    return {
        lookup: (varName, callNode) => lookupInEnv(env, varName, callNode, patternOverrides, options?.enclosingFunctionFinder, extractFuncNameHook),
        constructorBindings: bindings,
        fileScope: () => env.get(FILE_SCOPE) ?? emptyFileScope(),
        allScopes: () => env,
        constructorTypeMap,
        flush(filePath, accumulator) {
            if (flushed) {
                throw new Error(`[TypeEnvironment] flush called twice for ${filePath} — flush is single-use`);
            }
            const fileScope = env.get(FILE_SCOPE) ?? emptyFileScope();
            const entries = [];
            for (const [varName, typeName] of fileScope) {
                entries.push({ scope: '', varName, typeName });
            }
            if (entries.length > 0) {
                accumulator.appendFile(filePath, entries);
            }
            flushed = true;
        },
    };
};
