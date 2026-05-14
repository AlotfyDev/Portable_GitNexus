import type { ParsedFile } from '../../../../_shared/index.js';
import type { SemanticModel } from '../../model/semantic-model.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
export declare function detectGoInterfaceImplementations(parsedFiles: readonly ParsedFile[], _indexes: ScopeResolutionIndexes, _model: SemanticModel): Map<string, string[]>;
