import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREA_OF, accessChange, entitiesOf, recordOf, summarise, toCsv } from './audit-format.js';

/** Every `entity: '...'` the services of src/ write through AuditGateway.write. */
function writtenEntities(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return writtenEntities(path);
    if (!name.endsWith('.ts') || name.endsWith('.spec.ts')) return [];
    const source = readFileSync(path, 'utf8');
    if (!source.includes('audit.write(')) return [];
    return [...source.matchAll(/entity: '(\w+)'/g)].map((match) => match[1] ?? '');
  });
}

describe('audit areas (DEC-131)', () => {
  it('NFR-02 every entity written to the audit log belongs to an area', () => {
    const entities = new Set(writtenEntities(join(import.meta.dirname, '..', '..')));
    expect(entities.size).toBeGreaterThan(5);
    for (const entity of entities) expect(AREA_OF, entity).toHaveProperty(entity);
  });

  it('DEC-131 an area filter is the entities of that area', () => {
    expect(entitiesOf('Access')).toEqual([
      'user',
      'role_permissions',
      'planner_approval',
      'audit_archive',
    ]);
    expect(entitiesOf('Vehicles')).toEqual(['vehicle', 'vehicle_class']);
  });
});

describe('summary of a change (DEC-131)', () => {
  it('shows the status when it changes', () => {
    expect(summarise({ status: 'Pending_Approval' }, { status: 'Active' })).toEqual({
      before: 'Pending_Approval',
      after: 'Active',
    });
  });

  it('otherwise shows the changed fields, at most 3', () => {
    expect(
      summarise(
        { a: 1, b: 2, c: 3, d: 4, e: 5, status: 'Active' },
        { a: 9, b: 8, c: 7, d: 6, e: 5, status: 'Active' },
      ),
    ).toEqual({ before: 'a: 1, b: 2, c: 3', after: 'a: 9, b: 8, c: 7' });
  });

  it('shows what a new record holds and nothing before it', () => {
    expect(summarise(null, { code: 'STNK', active: true })).toEqual({
      before: null,
      after: 'code: STNK, active: true',
    });
  });

  it('writes an empty value as a dash and a list as its items', () => {
    expect(
      summarise({ kinds: [], until: null }, { kinds: ['spk_creation', 'tyre_count'], until: null }),
    ).toEqual({ before: 'kinds: —', after: 'kinds: spk_creation, tyre_count' });
  });

  it('cuts a long summary', () => {
    const { after } = summarise({ note: '' }, { note: 'x'.repeat(300) });
    expect(after).toHaveLength(120);
    expect(after?.endsWith('…')).toBe(true);
  });
});

describe('record label (REQ-IAM-007)', () => {
  it('uses the record’s own name, then the name of a single record, then the id', () => {
    expect(recordOf({ entity: 'spk', entityId: 4, recordName: 'SPK-2611150001' })).toBe(
      'SPK-2611150001',
    );
    expect(recordOf({ entity: 'planner_approval', entityId: 1, recordName: null })).toBe(
      'Planner approval',
    );
    expect(recordOf({ entity: 'role_permissions', entityId: 0, recordName: null })).toBe(
      'Roles and permissions',
    );
    expect(recordOf({ entity: 'spk', entityId: 4, recordName: null })).toBe('spk #4');
  });
});

describe('access change in words (FLW-AM-05)', () => {
  const at = new Date('2026-11-16T00:00:00.000Z');
  const names = new Map([
    [1, 'Rina'],
    [2, 'Yusuf'],
  ]);
  const change = (entity: string, action: string, before: unknown, after: unknown) =>
    accessChange({ entity, entityId: 1, action, before, after, at }, names);

  it('names each switch of Planner approval', () => {
    expect(
      change('planner_approval', 'switch_on', null, {
        kinds: ['spk_creation'],
        until: '2026-11-16T11:00:00.000Z',
      }),
    ).toBe('Planner approval on until 18:00 (SPK creation)');
    expect(
      change('planner_approval', 'change', null, {
        kinds: ['stock_opname'],
        until: '2026-11-17T11:00:00.000Z',
      }),
    ).toBe('Planner approval changed: on until 2026-11-17 18:00 (Stock opname)');
    expect(
      change('planner_approval', 'switch_on', null, { kinds: ['tyre_count'], until: null }),
    ).toBe('Planner approval on until it is switched off (Tyre count)');
    expect(change('planner_approval', 'switch_off', null, null)).toBe('Planner approval off');
    expect(change('planner_approval', 'end', null, null)).toBe(
      'Planner approval ended at its end time',
    );
  });

  it('names each account change', () => {
    const rina = { name: 'Rina', role: 'Planner' };
    expect(change('user', 'create', null, rina)).toBe('Created the account Rina (Planner)');
    expect(change('user', 'edit', rina, rina)).toBe('Edited the account Rina');
    expect(change('user', 'role_change', rina, { ...rina, role: 'Field_Coordinator' })).toBe(
      'Changed the role of Rina from Planner to Field Coordinator',
    );
    expect(change('user', 'deactivate', rina, rina)).toBe('Deactivated the account Rina');
    expect(change('user', 'activate', rina, rina)).toBe('Activated the account Rina');
    expect(change('user', 'unlock', rina, rina)).toBe('Unlocked the account Rina');
    expect(change('user', 'reset_password', rina, rina)).toBe('Reset the password of Rina');
    expect(change('user', 'move_system_admin', { systemAdminId: 1 }, { systemAdminId: 2 })).toBe(
      'Moved System Admin from Rina to Yusuf',
    );
    expect(change('user', 'move_system_admin', { systemAdminId: null }, { systemAdminId: 2 })).toBe(
      'Moved System Admin from nobody to Yusuf',
    );
  });

  it('lists permission changes, at most 3', () => {
    expect(
      change('role_permissions', 'change', null, {
        Planner: { 'spk.create': false, 'spk.view': true },
        GM: { 'audit.view': false, 'report.view': true },
      }),
    ).toBe(
      'Changed permissions: Planner spk.create off; Planner spk.view on; GM audit.view off and 1 more',
    );
  });
});

describe('CSV (DEC-74)', () => {
  it('starts with a BOM, quotes what needs it and writes a formula-like cell as text', () => {
    const csv = toCsv(
      ['A', 'B'],
      [
        ['x, y', 'say "hi"'],
        ['=1+2', '-3'],
        ['@me', '+4'],
      ],
    );
    expect(csv).toBe('﻿A,B\r\n"x, y","say ""hi"""\r\n\'=1+2,\'-3\r\n\'@me,\'+4\r\n');
  });
});
