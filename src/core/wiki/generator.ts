/**
 * Wiki Generator — barrel
 *
 * Re-exports WikiGenerator class and types from the generator/ module.
 */

export { WikiGenerator } from './generator/wiki-generator.js';
export type {
  WikiOptions,
  WikiMeta,
  ModuleTreeNode,
  ProgressCallback,
  WikiRunResult,
} from './generator/types.js';
