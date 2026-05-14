import type { ResolutionContext } from '../../model/resolution-context.js';
import type { HeritageMap } from '../../model/index.js';
import type { SymbolDefinition } from '../../../../_shared/index.js';
import type { ResolutionTier } from '../../model/resolution-context.js';
import type { ReceiverTypeIndex, FieldResolution } from '../types.js';
export declare const receiverKey: (scope: string, varName: string) => string;
export declare const buildReceiverTypeIndex: (map: Map<string, string>) => ReceiverTypeIndex;
export declare const lookupReceiverType: (index: ReceiverTypeIndex, funcName: string, varName: string) => string | undefined;
export declare const resolveFieldAccessType: (receiverName: string, fieldName: string, filePath: string, ctx: ResolutionContext) => FieldResolution | undefined;
export declare const resolveFieldOwnership: (receiverName: string, fieldName: string, filePath: string, ctx: ResolutionContext) => {
    nodeId: string;
    declaredType?: string;
} | undefined;
export declare const resolveMethodByOwner: (receiverTypeName: string, methodName: string, filePath: string, ctx: ResolutionContext, heritageMap?: HeritageMap, argCount?: number, ancestryView?: "instance" | "singleton") => {
    def: SymbolDefinition;
    tier: ResolutionTier;
} | undefined;
