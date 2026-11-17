import { describe, expect, it } from 'vitest';
import { STORAGE_LINK_SECONDS, storageKey } from './index.js';

describe('storage keys and links (NFR-13, DEC-135)', () => {
  it('DEC-135 a signed link lasts 15 minutes', () => {
    expect(STORAGE_LINK_SECONDS).toBe(900);
  });

  it('§9.12 a key is {env}/{yyyy}/{mm}/{entity}/{id}.{ext}, by the UTC month', () => {
    expect(
      storageKey({
        env: 'staging',
        at: new Date('2026-11-30T20:00:00.000Z'),
        entity: 'spk',
        id: '3f2c9a1e-7b4d-4e8a-9c21-5d6f7a8b9c0d',
        ext: 'jpg',
      }),
    ).toBe('staging/2026/11/spk/3f2c9a1e-7b4d-4e8a-9c21-5d6f7a8b9c0d.jpg');
  });

  it('refuses parts that would leave their folder', () => {
    const base = { env: 'local', at: new Date(), id: 'abc', ext: 'pdf' as const };
    expect(() => storageKey({ ...base, entity: '../etc' })).toThrow('Invalid storage key part');
    expect(() => storageKey({ ...base, entity: 'spk', id: 'a/b' })).toThrow(
      'Invalid storage key part',
    );
  });
});
