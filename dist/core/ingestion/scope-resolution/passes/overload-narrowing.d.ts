/**
 * Overload narrowing — pick candidates from a list of same-named
 * method / function overloads using the call-site's arity and
 * argument-type signals.
 *
 * Used by both `receiver-bound-calls.ts::pickOverload` (explicit
 * receiver member call) and `free-call-fallback.ts::pickImplicitThisOverload`
 * (implicit `this` free-call inside a class-like body). Shared to keep
 * narrowing semantics in lockstep across the two sites.
 *
 * Semantics (first-wins; callers take `result[0]`):
 *   1. If `argCount` is undefined, arity is a pass-through.
 *   2. Exact-required-match wins over variadic. Variadic is detected
 *      via a `parameterTypes` entry equal to `'params'` or starting
 *      with `'params '` (C# `params` / variadic marker).
 *   3. If the arity filter empties the set, fall back to the full
 *      overload list rather than returning nothing — the caller still
 *      needs a best-effort candidate.
 *   4. If `argTypes` is present, filter further by per-slot type
 *      equality. An empty string in `argTypes[i]` means "unknown" and
 *      counts as a match. Mismatches disqualify. A non-empty typed
 *      result wins; otherwise return the arity-filtered candidates.
 *   5. Empty input returns empty output.
 */
import type { SymbolDefinition } from '../../../../_shared/index.js';
export declare function narrowOverloadCandidates(overloads: readonly SymbolDefinition[], argCount: number | undefined, argTypes: readonly string[] | undefined): readonly SymbolDefinition[];
