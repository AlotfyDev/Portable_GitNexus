/**
 * Type Registry
 *
 * Class/struct/interface index extracted from SymbolTable.
 * Eagerly-populated indexes keyed by symbol name and qualified name.
 * Also includes a separate index for Rust Impl blocks.
 */
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export const createTypeRegistry = () => {
    const classByName = new Map();
    const classByQualifiedName = new Map();
    const implByName = new Map();
    const lookupClassByName = (name) => {
        return classByName.get(name) ?? [];
    };
    const lookupClassByQualifiedName = (qualifiedName) => {
        return classByQualifiedName.get(qualifiedName) ?? [];
    };
    const lookupImplByName = (name) => {
        return implByName.get(name) ?? [];
    };
    const registerClass = (name, qualifiedName, def) => {
        const existing = classByName.get(name);
        if (existing) {
            existing.push(def);
        }
        else {
            classByName.set(name, [def]);
        }
        const qualifiedMatches = classByQualifiedName.get(qualifiedName);
        if (qualifiedMatches) {
            qualifiedMatches.push(def);
        }
        else {
            classByQualifiedName.set(qualifiedName, [def]);
        }
    };
    const registerImpl = (name, def) => {
        const existing = implByName.get(name);
        if (existing) {
            existing.push(def);
        }
        else {
            implByName.set(name, [def]);
        }
    };
    const clear = () => {
        classByName.clear();
        classByQualifiedName.clear();
        implByName.clear();
    };
    return {
        lookupClassByName,
        lookupClassByQualifiedName,
        lookupImplByName,
        registerClass,
        registerImpl,
        clear,
    };
};
