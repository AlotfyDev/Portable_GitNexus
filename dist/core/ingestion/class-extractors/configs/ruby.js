// gitnexus/src/core/ingestion/class-extractors/configs/ruby.ts
import { SupportedLanguages } from '../../../../_shared/index.js';
export const rubyClassConfig = {
    language: SupportedLanguages.Ruby,
    typeDeclarationNodes: ['class'],
    ancestorScopeNodeTypes: ['module', 'class'],
};
