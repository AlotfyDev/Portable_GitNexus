import type { SymbolDefinition } from '../../../_shared/index.js';
import type { SyntaxNode } from '../utils/ast-helpers.js';
import type { LiteralTypeInferrer } from '../type-extractors/types.js';
import type { TypeEnvironment } from '../type-env.js';
/** Per-file resolved type bindings for exported symbols. */
export type ExportedTypeMap = Map<string, Map<string, string>>;
/**
 * Resolution result with confidence scoring
 */
export interface ResolveResult {
    nodeId: string;
    confidence: number;
    reason: string;
    returnType?: string;
}
/**
 * Optional hints for overload disambiguation via argument literal types.
 * Only available on the sequential path (has AST); worker path passes undefined.
 */
export interface OverloadHints {
    callNode: SyntaxNode;
    inferLiteralType: LiteralTypeInferrer;
    typeEnv?: TypeEnvironment;
}
/** Per-file cache for module-alias widening. Cleared between files. */
export type WidenCache = Map<string, readonly SymbolDefinition[]>;
export type ReceiverTypeEntry = {
    readonly kind: 'resolved';
    readonly value: string;
} | {
    readonly kind: 'ambiguous';
};
export type ReceiverTypeIndex = Map<string, Map<string, ReceiverTypeEntry>>;
export interface FieldResolution {
    typeName: string;
    fieldNodeId: string;
}
export type OnFieldResolved = (fieldNodeId: string) => void;
