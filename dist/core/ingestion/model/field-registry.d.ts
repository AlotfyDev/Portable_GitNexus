/**
 * Field Registry
 *
 * Owner-scoped field/property index extracted from SymbolTable.
 * Stores Property symbols keyed by `ownerNodeId\0fieldName` for O(1) lookup.
 */
import type { SymbolDefinition } from '../../../_shared/index.js';
export interface FieldRegistry {
    /** Look up a field/property by its owning class nodeId and field name. */
    lookupFieldByOwner(ownerNodeId: string, fieldName: string): SymbolDefinition | undefined;
}
export interface MutableFieldRegistry extends FieldRegistry {
    /** Register a field/property under its owner. */
    register(ownerNodeId: string, fieldName: string, def: SymbolDefinition): void;
    /** Clear all entries. */
    clear(): void;
}
export declare const createFieldRegistry: () => MutableFieldRegistry;
