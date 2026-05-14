import { defaultDispatchDecision } from '../default-dispatch.js';
import { resolveFreeCall } from './resolve-free-call.js';
import { resolveStaticCall } from './resolve-static-call.js';
import { resolveMemberCall } from './resolve-member-call.js';
import { resolveMemberCallByFile } from './member-call-by-file.js';
import { resolveModuleAliasedCall } from './module-aliased-call.js';
import { singleCandidate } from './single-candidate.js';
import { countCallableCandidates } from './callable-candidates.js';
/** @internal Exported for unit tests. */
export const _resolveCallTargetForTesting = (call, currentFile, ctx, opts) => resolveCallTarget(call, currentFile, ctx, opts?.overloadHints, opts?.widenCache, opts?.preComputedArgTypes, opts?.heritageMap);
export const resolveCallTarget = (call, currentFile, ctx, overloadHints, widenCache, preComputedArgTypes, heritageMap, dispatchDecision) => {
    const tiered = ctx.resolve(call.calledName, currentFile);
    if (!tiered)
        return null;
    const decision = dispatchDecision ?? defaultDispatchDecision(call.callForm);
    const primary = decision.primary;
    if (primary === 'free') {
        return resolveFreeCall(call.calledName, currentFile, ctx, call.argCount, tiered, overloadHints, preComputedArgTypes);
    }
    if (primary === 'constructor') {
        return (resolveStaticCall(call.calledName, currentFile, ctx, call.argCount, tiered, overloadHints, preComputedArgTypes) ?? singleCandidate(tiered, call.argCount, 'constructor'));
    }
    // primary === 'owner-scoped'
    if (call.receiverTypeName) {
        const skipMember = (!!overloadHints || !!preComputedArgTypes) &&
            countCallableCandidates(tiered.candidates, call.argCount, call.callForm) > 1;
        const singletonDispatch = decision.ancestryView === 'singleton';
        const memberResult = (!skipMember
            ? resolveMemberCall(call.receiverTypeName, call.calledName, currentFile, ctx, heritageMap, call.argCount, decision.ancestryView)
            : null) ??
            (singletonDispatch
                ? null
                : resolveMemberCallByFile(call.calledName, call.receiverTypeName, currentFile, ctx, call.argCount, call.callForm, overloadHints, preComputedArgTypes));
        if (memberResult)
            return memberResult;
        const typeResolves = ctx.resolve(call.receiverTypeName, currentFile);
        const aliasMap = ctx.moduleAliasMap?.get(currentFile);
        const aliasTargetFile = call.receiverName && aliasMap ? aliasMap.get(call.receiverName) : undefined;
        if (aliasTargetFile &&
            typeResolves &&
            typeResolves.candidates.some((c) => c.filePath === aliasTargetFile)) {
            const aliasResult = resolveModuleAliasedCall(call, currentFile, ctx, widenCache, tiered);
            if (aliasResult)
                return aliasResult;
        }
        if (typeResolves && typeResolves.candidates.length > 0) {
            if (decision.fallback === 'free-arity-narrowed') {
                const free = resolveFreeCall(call.calledName, currentFile, ctx, call.argCount, tiered, overloadHints, preComputedArgTypes);
                if (free)
                    return free;
            }
            return null;
        }
        return singleCandidate(tiered, call.argCount, call.callForm);
    }
    return (resolveModuleAliasedCall(call, currentFile, ctx, widenCache, tiered) ??
        singleCandidate(tiered, call.argCount, call.callForm));
};
/** Extract the bare function name from a sourceId. */
export const extractFuncNameFromSourceId = (sourceId) => {
    const lastColon = sourceId.lastIndexOf(':');
    const segment = lastColon >= 0 ? sourceId.slice(lastColon + 1) : '';
    const dotIdx = segment.lastIndexOf('.');
    const raw = dotIdx >= 0 ? segment.slice(dotIdx + 1) : segment;
    const hashIdx = raw.indexOf('#');
    return hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
};
