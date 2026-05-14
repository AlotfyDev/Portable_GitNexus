import type { ReturnTypeLookup, PendingAssignment } from '../../type-extractors/types.js';
import type { SemanticModel } from '../../model/index.js';
import type { TypeEnv } from '../types.js';
export declare const resolveFixpointBindings: (pendingItems: Array<{
    scope: string;
} & PendingAssignment>, env: TypeEnv, returnTypeLookup: ReturnTypeLookup, model?: SemanticModel, parentMap?: ReadonlyMap<string, readonly string[]>) => void;
