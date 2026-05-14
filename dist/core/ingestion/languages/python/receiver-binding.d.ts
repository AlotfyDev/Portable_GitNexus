/**
 * Synthesize `@type-binding.self` / `@type-binding.cls` captures for
 * methods.
 *
 * Tree-sitter can't easily express "the first parameter of a function
 * defined directly inside a class body" via a single static query.
 * Doing this in code keeps the embedded scope query declarative and
 * lets us encode the `@classmethod` / `@staticmethod` decorator
 * awareness that Python's runtime depends on.
 */
import type { CaptureMatch } from '../../../../_shared/index.js';
import { type SyntaxNode } from '../../utils/ast-helpers.js';
/**
 * Build a `@type-binding.self` (instance method) or `@type-binding.cls`
 * (`@classmethod`) match for `fnNode`, or `null` if `fnNode` is not a
 * method, is `@staticmethod`, or has no parameters.
 *
 * The caller is responsible for guaranteeing `fnNode.type ===
 * 'function_definition'`.
 */
export declare function synthesizeReceiverTypeBinding(fnNode: SyntaxNode): CaptureMatch | null;
