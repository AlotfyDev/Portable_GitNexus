import type { ClassDefRef } from '../types.js';
export declare const isSubclassOf: (child: string, parent: string, parentMap: ReadonlyMap<string, readonly string[]> | undefined) => boolean;
export declare const walkParentChain: <T>(typeName: string, parentMap: ReadonlyMap<string, readonly string[]> | undefined, getClassDefs: (name: string) => ClassDefRef[], lookupOnClass: (nodeId: string) => T | undefined) => T | undefined;
