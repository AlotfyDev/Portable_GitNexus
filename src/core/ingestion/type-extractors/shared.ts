export type { TypeArgPosition } from './shared/types.js';
export { TYPED_PARAMETER_TYPES } from './shared/constants.js';

export { extractSimpleTypeName } from './shared/simple-type.js';

export { extractGenericTypeArgs, extractElementTypeFromString } from './shared/generics.js';

export { extractReturnTypeName } from './shared/return-type.js';

export { methodToTypeArgPosition, getContainerDescriptor, resolveIterableElementType } from './shared/container.js';

export { extractVarName } from './shared/var-name.js';

export { stripNullable } from './shared/nullable.js';

export { extractRubyConstructorAssignment, hasTypeAnnotation, unwrapAwait, extractCalleeName } from './shared/misc.js';
