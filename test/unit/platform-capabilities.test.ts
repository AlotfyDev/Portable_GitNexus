import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isVectorExtensionSupportedByPlatform } from '../../src/core/platform/capabilities.js';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('platform capabilities', () => {
  it('returns true by default (auto mode)', () => {
    expect(isVectorExtensionSupportedByPlatform('win32')).toBe(true);
    expect(isVectorExtensionSupportedByPlatform('linux')).toBe(true);
    expect(isVectorExtensionSupportedByPlatform('darwin')).toBe(true);
  });
});
