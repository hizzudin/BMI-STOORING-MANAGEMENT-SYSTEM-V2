import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// TASK-203 (4.3 build note, REQ-REG-006, DEC-149): no business code names a module, so a new
// module changes none of it; and no migration registers the engine's test module (DEC-144).

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');

/**
 * Module codes that are nothing but module codes. 'Stock', 'Document' and 'Part_Check' are left
 * out: they are also a cost kind, an SPK category or an SPK source of §9.1.
 */
const MODULE_ONLY_CODES = [
  'Part_Purchase',
  'Mechanic_Action',
  'Part_Replacement',
  'Mobilisasi',
  'Dummy',
];

const BUSINESS_DIRS = [
  'apps/api/src/engine',
  'apps/api/src/core',
  'apps/api/src/http',
  'apps/api/src/ports',
  'packages/shared/src/permissions',
  'packages/shared/src/machines',
  'packages/shared/src/registry',
  'packages/shared/src/schemas',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(name) || /\.(spec|test)\.tsx?$/.test(name)) return [];
    return [path];
  });
}

function moduleCodeLiterals(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return MODULE_ONLY_CODES.filter((code) => source.includes(`'${code}'`)).map(
      (code) => `${file}: '${code}'`,
    );
  });
}

describe('TASK-203 static checks (REQ-REG-006, DEC-149)', () => {
  it('REQ-REG-006 no business file names a module-only code', () => {
    const files = BUSINESS_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(50);
    expect(moduleCodeLiterals(files)).toEqual([]);
  });

  it('DEC-149 DEC-144 no migration inserts the Dummy row', () => {
    const migrations = join(ROOT, 'apps/api/migrations');
    const offenders = readdirSync(migrations)
      .filter((name) => name.endsWith('.sql'))
      .filter((name) => readFileSync(join(migrations, name), 'utf8').includes(`'Dummy'`));
    expect(offenders).toEqual([]);
  });
});
