/**
 * Field Registry
 *
 * Owner-scoped field/property index extracted from SymbolTable.
 * Stores Property symbols keyed by `ownerNodeId\0fieldName` for O(1) lookup.
 */
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export const createFieldRegistry = () => {
    const fieldByOwner = new Map();
    const lookupFieldByOwner = (ownerNodeId, fieldName) => {
        return fieldByOwner.get(`${ownerNodeId}\0${fieldName}`);
    };
    const register = (ownerNodeId, fieldName, def) => {
        fieldByOwner.set(`${ownerNodeId}\0${fieldName}`, def);
    };
    const clear = () => {
        fieldByOwner.clear();
    };
    return { lookupFieldByOwner, register, clear };
};
