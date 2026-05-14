import type { MethodInfo } from '../method-types.js';
import { SupportedLanguages } from '../../../_shared/index.js';
/**
 * Compute arity for ID-generation purposes.
 * Returns `undefined` when any parameter is variadic (arity is indeterminate).
 */
export declare function arityForIdFromInfo(info: MethodInfo): number | undefined;
/**
 * Compute a type-based discriminator suffix for same-arity overloads.
 * Returns `~type1,type2` when the current method collides with another method
 * in the same class that has the same name and arity but different parameter types.
 * Returns `''` when there is no collision or types are unavailable.
 */
/**
 * Build collision groups from a method map — groups methods by `name#arity`.
 * Call once per class, then pass to typeTagForId/constTagForId to avoid O(N²) scans.
 */
export declare function buildCollisionGroups(methodMap: Map<string, MethodInfo>): Map<string, MethodInfo[]>;
export declare function typeTagForId(methodMap: Map<string, MethodInfo>, methodName: string, arity: number | undefined, currentInfo: MethodInfo, language?: SupportedLanguages, 
/** Pre-built collision groups from buildCollisionGroups(). Avoids O(N) scan per call. */
collisionGroups?: Map<string, MethodInfo[]>): string;
/**
 * Compute a const-qualifier suffix for C++ const/non-const method collisions.
 * Returns `$const` when the current method is const-qualified and a non-const
 * method with the same name and arity exists in the same class.
 * Returns `''` when there is no collision or the method is not const-qualified.
 */
export declare function constTagForId(methodMap: Map<string, MethodInfo>, methodName: string, arity: number | undefined, currentInfo: MethodInfo, 
/** Pre-built collision groups from buildCollisionGroups(). Avoids O(N) scan per call. */
collisionGroups?: Map<string, MethodInfo[]>): string;
/** Convert MethodInfo from methodExtractor into flat properties for a graph node. */
export declare function buildMethodProps(info: MethodInfo): Record<string, unknown>;
