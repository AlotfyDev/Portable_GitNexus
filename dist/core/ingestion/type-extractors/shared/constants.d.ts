interface ContainerDescriptor {
    arity: number;
    keyMethods: ReadonlySet<string>;
    valueMethods: ReadonlySet<string>;
}
export type { ContainerDescriptor };
export declare const TYPED_PARAMETER_TYPES: Set<string>;
export declare const CONTAINER_DESCRIPTORS: ReadonlyMap<string, ContainerDescriptor>;
export declare const NULLABLE_WRAPPER_TYPES: Set<string>;
export declare const NULLABLE_KEYWORDS: Set<string>;
export declare const PRIMITIVE_TYPES: Set<string>;
export declare const WRAPPER_GENERICS: Set<string>;
export declare const MAX_RETURN_TYPE_INPUT_LENGTH = 2048;
export declare const MAX_RETURN_TYPE_LENGTH = 512;
