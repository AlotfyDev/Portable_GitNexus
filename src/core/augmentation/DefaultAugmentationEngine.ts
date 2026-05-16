import { augment } from './engine.js';
import type { AugmentationEngine } from '../config/AugmentationEngine.js';

export class DefaultAugmentationEngine implements AugmentationEngine {
  readonly name = 'default';

  async augment(pattern: string, cwd?: string): Promise<string> {
    return augment(pattern, cwd);
  }
}
