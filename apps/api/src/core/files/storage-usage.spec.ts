import { describe, expect, it } from 'vitest';
import { usageNotice, usageStep } from './storage-usage.js';

describe('storage usage steps (DEC-137)', () => {
  it('DEC-137 no step below the alert percentage', () => {
    expect(usageStep(79.9, 80)).toBeNull();
  });

  it('DEC-137 steps of 5% from the alert percentage, beyond 100%', () => {
    expect(usageStep(80, 80)).toBe(80);
    expect(usageStep(84.99, 80)).toBe(80);
    expect(usageStep(85, 80)).toBe(85);
    expect(usageStep(92, 80)).toBe(90);
    expect(usageStep(107, 80)).toBe(105);
  });

  it('DEC-137 the notice names the whole percentage and the GB with one decimal', () => {
    expect(usageNotice(41 * 1024 ** 3, 50, 82.4)).toEqual({
      title: 'File storage is 82% full',
      body: '41.0 GB of the 50 GB budget is used.',
    });
  });
});
