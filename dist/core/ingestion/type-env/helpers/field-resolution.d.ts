import type { SemanticModel } from '../../model/index.js';
import type { ClassDefRef } from '../types.js';
export declare const resolveFieldType: (receiver: string, field: string, scopeEnv: ReadonlyMap<string, string>, model?: SemanticModel, getClassDefs?: (typeName: string) => ClassDefRef[], parentMap?: ReadonlyMap<string, readonly string[]>) => string | undefined;
