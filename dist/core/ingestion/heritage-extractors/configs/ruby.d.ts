import type { HeritageExtractionConfig } from '../../heritage-types.js';
/**
 * Ruby heritage extraction config.
 *
 * Ruby expresses inheritance in two ways, and only one of them has
 * dedicated tree-sitter heritage captures:
 *
 * 1. Class inheritance (`class A < B`) produces standard
 *    `@heritage.extends` captures and flows through the generic
 *    capture-based `extract` hook (not defined here — the factory
 *    handles it).
 * 2. Mixin calls (`include`/`extend`/`prepend`) have no dedicated
 *    heritage captures; they surface as ordinary call sites. The
 *    `callBasedHeritage` hook below intercepts them before the call
 *    router, absorbing the mixin routing logic that previously lived
 *    in call-routing.ts (routeRubyCall).
 */
export declare const rubyHeritageConfig: HeritageExtractionConfig;
