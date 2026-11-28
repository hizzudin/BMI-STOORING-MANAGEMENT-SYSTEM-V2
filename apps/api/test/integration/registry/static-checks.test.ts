import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// TASK-203 (4.3 build note, REQ-REG-006, DEC-149, ADR-0002 merge review 4): no business code or
// client names a module, so a new module changes none of it; and no migration registers the
// engine's test module (DEC-144).

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');

/** Codes that are nothing but module codes: any quoted literal of one is a finding. */
const MODULE_ONLY_CODES = [
  'Part_Purchase',
  'Mechanic_Action',
  'Part_Replacement',
  'Mobilisasi',
  'Dummy',
];
/**
 * Module codes that are also a cost kind, an SPK category or an SPK source of §9.1: a finding only
 * where they are compared or switched on as a module (`module === 'Stock'`, `case "Stock"`).
 */
const SHARED_WORD_CODES = ['Stock', 'Document', 'Part_Check'];

/** The server's business code and the clients, where the designer and step screens live. */
const SCANNED_DIRS = [
  'apps/api/src/engine',
  'apps/api/src/core',
  'apps/api/src/http',
  'apps/api/src/ports',
  'apps/api/src/infra',
  'packages/shared/src',
  'apps/web/app',
  'apps/web/components',
  'apps/web/lib',
  'apps/mobile/app',
  'apps/mobile/src',
];

/** Files that write code-less rows on purpose (DEC-148): the trial and e2e seeds. */
const SEEDS = ['apps/api/src/infra/db/trial/', 'apps/api/src/infra/db/e2e-database-cli.ts'];

/**
 * Each legitimate use, by file and code, so every exception is visible in review. A case of a
 * shared word in a switch over SPK categories or cost kinds belongs here, never a module branch.
 */
const ALLOWED: ReadonlyArray<readonly [file: string, code: string]> = [];

function sourceFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' || name.startsWith('.') ? [] : sourceFiles(path);
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.(spec|test)\.tsx?$/.test(name)) return [];
    return [path];
  });
}

const quoted = (code: string) => `['"]${code}['"]`;
const moduleContext = (code: string) =>
  new RegExp(
    `(\\bmodule\\w*\\s*(===|!==|==|!=|:)\\s*${quoted(code)})|(\\bcode\\s*(===|!==|==|!=)\\s*${quoted(code)})|(\\bcase\\s+${quoted(code)})`,
  );

function moduleCodeFindings(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const path = relative(ROOT, file).replaceAll('\\', '/');
    if (SEEDS.some((seed) => path.startsWith(seed))) return [];
    const source = readFileSync(file, 'utf8');
    const found = [
      ...MODULE_ONLY_CODES.filter((code) => new RegExp(quoted(code)).test(source)),
      ...SHARED_WORD_CODES.filter((code) => moduleContext(code).test(source)),
    ];
    return found
      .filter(
        (code) =>
          !ALLOWED.some(([allowedFile, allowed]) => allowedFile === path && allowed === code),
      )
      .map((code) => `${path}: ${code}`);
  });
}

describe('TASK-203 static checks (REQ-REG-006, DEC-149)', () => {
  it('REQ-REG-006 no business or client file names a module code', () => {
    const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(200);
    expect(moduleCodeFindings(files)).toEqual([]);
  });

  it('REQ-REG-006 the check sees a module branch on a shared word and a double-quoted code', () => {
    expect(moduleContext('Stock').test(`if (step.module === "Stock") {`)).toBe(true);
    expect(moduleContext('Document').test(`case 'Document':`)).toBe(true);
    expect(moduleContext('Document').test(`category: 'Document',`)).toBe(false);
    expect(new RegExp(quoted('Mechanic_Action')).test(`const m = "Mechanic_Action";`)).toBe(true);
  });

  it('DEC-149 DEC-144 no migration inserts the Dummy row', () => {
    const migrations = join(ROOT, 'apps/api/migrations');
    const offenders = readdirSync(migrations)
      .filter((name) => name.endsWith('.sql'))
      .filter((name) =>
        new RegExp(quoted('Dummy')).test(readFileSync(join(migrations, name), 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});
