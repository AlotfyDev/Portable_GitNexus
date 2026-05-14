// gitnexus/src/core/ingestion/class-extractors/configs/c-cpp.ts
import { SupportedLanguages } from '../../../../_shared/index.js';
export const cClassConfig = {
    language: SupportedLanguages.C,
    typeDeclarationNodes: ['struct_specifier', 'enum_specifier'],
};
export const cppClassConfig = {
    language: SupportedLanguages.CPlusPlus,
    typeDeclarationNodes: ['class_specifier', 'struct_specifier', 'enum_specifier'],
    ancestorScopeNodeTypes: ['namespace_definition', 'class_specifier', 'struct_specifier'],
};
