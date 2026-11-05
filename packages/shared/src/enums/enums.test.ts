/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SQL_ENUMS } from './index.js';

const dataModel = readFileSync(
  new URL('../../../../docs/prd/data-model.md', import.meta.url),
  'utf8',
);
const section = dataModel.split('## 9.1')[1]?.split('## 9.2')[0] ?? '';
const specEnums = Object.fromEntries(
  [...section.matchAll(/CREATE TYPE (\w+)\s+AS ENUM \(([^)]*)\)/g)].map((match) => [
    match[1],
    [...(match[2] ?? '').matchAll(/'([^']+)'/g)].map((value) => value[1]),
  ]),
);

describe('Section 9.1 enums', () => {
  it('finds the enums of section 9.1 in the data model', () => {
    expect(Object.keys(specEnums).length).toBeGreaterThanOrEqual(26);
  });

  it('holds every enum of section 9.1 with the same values in the same order', () => {
    expect(SQL_ENUMS).toEqual(specEnums);
  });

  it('holds each enum once, with no repeated value', () => {
    for (const values of Object.values(SQL_ENUMS)) {
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
