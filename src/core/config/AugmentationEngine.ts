export interface AugmentationEngine {
  readonly name: string;
  augment(pattern: string, cwd?: string): Promise<string>;
}
