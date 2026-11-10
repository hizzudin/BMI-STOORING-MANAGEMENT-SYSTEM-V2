import { describe, expect, it } from 'vitest';
import type { Role } from '../enums/index.js';
import {
  blockedInSetupMode,
  defaultRolePermissions,
  menuFor,
  PERMISSION_CODES,
  type PermissionCode,
} from './index.js';

const rows = defaultRolePermissions();
const allowed = (role: Role) =>
  new Set(rows.filter((r) => r.role === role && r.allowed).map((r) => r.permissionCode));
const cell = (role: Role, code: PermissionCode) =>
  rows.find((r) => r.role === role && r.permissionCode === code);
const menu = (role: Role, mode: 'Setup' | 'Live' = 'Live') =>
  menuFor(allowed(role), mode).map((item) => item.label);

describe('2.4 permission catalogue and 2.2 default matrix', () => {
  it('REQ-IAM-012 every role has one row per catalogue code and nothing else', () => {
    expect(rows).toHaveLength(10 * PERMISSION_CODES.length);
    expect(new Set(rows.map((r) => r.permissionCode))).toEqual(new Set(PERMISSION_CODES));
  });

  it('RL-3 DEC-08 the System Admin holds every operational code but never accounts or the switch', () => {
    const codes = allowed('System_Admin');
    expect(codes.has('accounts.manage')).toBe(false);
    expect(codes.has('iam.planner_approval_switch')).toBe(false);
    for (const code of [
      'spk.create',
      'spk.approve',
      'count.approve',
      'stock.issue',
      'mechanic.execute',
      'docstep.execute',
      'vehicle.manage',
      'setup.golive',
    ] as const) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it('REQ-BRK-004 only Planners hold the urgent report pop-up', () => {
    const holders = rows.filter((r) => r.permissionCode === 'breakdown.urgent_alert' && r.allowed);
    expect(holders.map((r) => r.role)).toEqual(['Planner']);
  });

  it('RL-7 the Planner approval cells are off and locked: only the switch turns them on', () => {
    expect(cell('Planner', 'spk.approve')).toMatchObject({ allowed: false, isLocked: true });
    expect(cell('Planner', 'count.approve')).toMatchObject({ allowed: false, isLocked: true });
    expect(cell('Supervisor', 'spk.approve')).toMatchObject({ allowed: true, isLocked: true });
  });

  it('RL-5 the Access Manager holds accounts, the switch and the audit log, and no operational code can be given to it', () => {
    expect([...allowed('Access_Manager')].sort()).toEqual([
      'accounts.manage',
      'audit.view',
      'iam.planner_approval_switch',
    ]);
    expect(cell('Access_Manager', 'spk.create')?.isLocked).toBe(true);
    expect(cell('Access_Manager', 'audit.view')?.isLocked).toBe(false);
  });

  it('RL-6 the Field Coordinator acts only on its own cells; its views stay editable', () => {
    const codes = allowed('Field_Coordinator');
    for (const code of [
      'breakdown.send',
      'purchase.line',
      'changerequest.raise',
      'vehicle.driver_set',
      'files.upload',
    ] as const) {
      expect(codes.has(code)).toBe(true);
    }
    for (const code of [
      'spk.create',
      'stock.issue',
      'schedule.manage',
      'step.verify',
      'spk.approve',
    ] as const) {
      expect(cell('Field_Coordinator', code)).toMatchObject({ allowed: false, isLocked: true });
    }
    expect(cell('Field_Coordinator', 'breakdown.view')).toMatchObject({
      allowed: true,
      isLocked: false,
    });
    expect(cell('Field_Coordinator', 'breakdown.review')?.allowed).toBe(false);
  });

  it('RL-9 Accounting does no maintenance work; its views stay editable (AC-IAM-009)', () => {
    expect([...allowed('Accounting')].sort()).toEqual([
      'dashboard.view',
      'invoice.manage',
      'invoice.view',
      'report.view',
      'vehicle.view',
    ]);
    expect(cell('Accounting', 'mechanic.execute')?.isLocked).toBe(true);
    expect(cell('Accounting', 'vehicle.view')).toMatchObject({ allowed: true, isLocked: false });
  });

  it('DEC-115 a - cell is off but editable, and files.upload belongs to the executor roles', () => {
    expect(cell('Mechanic', 'step.assign')).toMatchObject({ allowed: false, isLocked: false });
    const uploaders = rows
      .filter((r) => r.permissionCode === 'files.upload' && r.allowed)
      .map((r) => r.role);
    expect(uploaders).toEqual([
      'Planner',
      'Mechanic',
      'Warehouse_Manager',
      'System_Admin',
      'Driver',
      'Field_Coordinator',
    ]);
  });

  it('RL-8 the GM sees invoices read only and the audit log; the Supervisor manages invoices', () => {
    expect(allowed('GM').has('invoice.manage')).toBe(false);
    expect(allowed('GM').has('invoice.view')).toBe(true);
    expect(allowed('GM').has('audit.view')).toBe(true);
    expect(allowed('Supervisor').has('invoice.manage')).toBe(true);
  });

  it('2.2 a V cell grants only the view code of its row; an X cell grants both', () => {
    expect(allowed('Field_Coordinator').has('schedule.view')).toBe(true);
    expect(allowed('Field_Coordinator').has('schedule.manage')).toBe(false);
    expect(allowed('Planner').has('breakdown.view')).toBe(true);
    expect(allowed('Planner').has('breakdown.review')).toBe(true);
  });
});

describe('NAV-9 the 2.4 menu table', () => {
  it('NAV-9 the System Admin sees every Live item; Setup and go live only in Setup mode', () => {
    expect(menu('System_Admin')).toEqual([
      'Dashboard',
      'Surat Perintah Kerja',
      'Report Breakdown',
      'Schedule',
      'Approvals',
      'Inventory',
      'Vehicles',
      'Documents',
      'Invoices',
      'Customers',
      'Reports',
      'Settings',
      'Audit log',
    ]);
    expect(menu('System_Admin', 'Setup')).toContain('Setup and go live');
  });

  it('NAV-9 Mechanics have no Approvals; Planners see it only while the switch is on', () => {
    expect(menu('Mechanic')).not.toContain('Approvals');
    expect(menu('Planner')).not.toContain('Approvals');
    expect(
      menuFor(new Set([...allowed('Planner'), 'spk.approve' as const]), 'Live').map((i) => i.label),
    ).toContain('Approvals');
  });

  it('NAV-9 Accounting sees Dashboard, Vehicles, Documents, Invoices, Customers and Reports', () => {
    expect(menu('Accounting')).toEqual([
      'Dashboard',
      'Vehicles',
      'Documents',
      'Invoices',
      'Customers',
      'Reports',
    ]);
  });

  it('NAV-9 the Access Manager has its own navigation: Users and roles, Audit log', () => {
    expect(menu('Access_Manager')).toEqual(['Users and roles', 'Audit log']);
  });
});

describe('REQ-IAM-010 Setup mode', () => {
  it('REQ-IAM-010 blocks spk.*, step.*, *.execute and the listed operational codes', () => {
    const blocked = PERMISSION_CODES.filter(blockedInSetupMode);
    expect(blocked).toEqual([
      'spk.view',
      'spk.create',
      'spk.approve',
      'spk.cancel',
      'stock.issue',
      'purchase.line',
      'mechanic.execute',
      'mobilisasi.execute',
      'docstep.execute',
      'step.verify',
      'step.request_completion',
      'step.assign',
      'changerequest.raise',
      'count.approve',
      'schedule.manage',
      'invoice.manage',
    ]);
  });
});
