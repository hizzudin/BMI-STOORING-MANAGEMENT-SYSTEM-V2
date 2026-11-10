import type { Role } from '../enums/index.js';

/** PRD 2.4: the only `role_permissions.permission_code` values; a new code is added here first. */
export const PERMISSION_CODES = [
  'dashboard.view',
  'spk.view',
  'spk.create',
  'breakdown.view',
  'breakdown.review',
  'breakdown.send',
  'breakdown.urgent_alert',
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
  'registry.manage',
  'parttype.manage',
  'masterdata.manage',
  'settings.manage',
  'vehicle.view',
  'vehicle.manage',
  'vehicle.driver_set',
  'odometer.manual',
  'inspection.proxy',
  'inspection.perform',
  'driver.menu',
  'inventory.manage',
  'tyre.manage',
  'count.approve',
  'schedule.view',
  'schedule.manage',
  'partage.view',
  'invoice.view',
  'invoice.manage',
  'report.view',
  'audit.view',
  'accounts.manage',
  'iam.planner_approval_switch',
  'ai.settings',
  'setup.golive',
  'files.upload',
] as const;
export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const isViewCode = (code: PermissionCode): boolean => code.endsWith('.view');

/**
 * A cell of the 2.2 matrix: X allowed, V view only, '' not allowed, S switchable (off until the
 * Planner approval switch), XL allowed and locked, L locked off, '-' not allowed by default (DEC-115).
 */
export type Cell = 'X' | 'V' | '' | 'S' | 'XL' | 'L' | '-';

/** Column order of the 2.2 table. */
export const MATRIX_ROLES = [
  'Planner',
  'Mechanic',
  'Warehouse_Manager',
  'Supervisor',
  'GM',
  'System_Admin',
  'Access_Manager',
  'Driver',
  'Field_Coordinator',
  'Accounting',
] as const satisfies readonly Role[];

type Cells = readonly [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

interface MatrixRow {
  capability: string;
  /** The row's view code: granted by V and by X. */
  view?: PermissionCode;
  /** The row's action codes: granted by X and XL; S keeps them off until the switch. */
  actions?: readonly PermissionCode[];
  cells: Cells;
}

/** PRD 2.2, cell for cell (PLN MEC WHM SUP GM SA AM DRV FC ACC). */
export const PERMISSION_MATRIX: readonly MatrixRow[] = [
  {
    capability: 'Role dashboard',
    view: 'dashboard.view',
    cells: ['V', 'V', 'V', 'V', 'V', 'V', '', 'V', 'V', 'V'],
  },
  {
    capability: 'View Surat Perintah Kerja',
    view: 'spk.view',
    cells: ['V', 'V', 'V', 'V', 'V', 'X', '', '', 'V', ''],
  },
  {
    capability: 'Report Breakdown list; create an SPK from a report or reject it',
    view: 'breakdown.view',
    actions: ['breakdown.review'],
    cells: ['X', '', '', '', '', 'X', '', '', 'V', ''],
  },
  {
    capability: 'Create, edit and submit an SPK',
    actions: ['spk.create'],
    cells: ['X', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Approve or reject SPK creation, amendment, completion',
    actions: ['spk.approve'],
    cells: ['S', '', '', 'XL', 'XL', 'XL', '', '', '', ''],
  },
  {
    capability: 'Cancel an SPK',
    actions: ['spk.cancel'],
    cells: ['', '', '', 'X', 'X', 'X', '', '', '', ''],
  },
  {
    capability: 'Stock step',
    actions: ['stock.issue'],
    cells: ['', '', 'X', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Part Purchase step',
    actions: ['purchase.line'],
    cells: ['', '', 'X', '', '', 'X', '', '', 'X', ''],
  },
  {
    capability: 'Execute Mechanic Action or Part Replacement',
    actions: ['mechanic.execute'],
    cells: ['', 'X', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Execute a Mobilisasi step',
    actions: ['mobilisasi.execute'],
    cells: ['', 'X', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Execute a Document step',
    actions: ['docstep.execute'],
    cells: ['', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Verify or return a step',
    actions: ['step.verify'],
    cells: ['X', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Request completion approval',
    actions: ['step.request_completion'],
    cells: ['X', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Raise a change request',
    actions: ['changerequest.raise'],
    cells: ['', 'X', 'X', '', '', 'X', '', '', 'X', ''],
  },
  {
    capability: 'Build SPK steps, maintain SPK presets and PM packages',
    actions: ['registry.manage'],
    cells: ['X', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Part item types',
    actions: ['parttype.manage'],
    cells: ['X', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Other master data',
    actions: ['masterdata.manage', 'settings.manage'],
    cells: ['', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Add, edit, deactivate vehicles; documents; baseline; odometer void',
    actions: ['vehicle.manage'],
    cells: ['', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Record a manual odometer reading',
    actions: ['odometer.manual'],
    cells: ['X', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Inspection and Report Breakdown for a driver',
    actions: ['inspection.proxy'],
    cells: ['', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Send a Report Breakdown',
    actions: ['breakdown.send'],
    cells: ['', 'X', '', '', '', 'X', '', 'X', 'X', ''],
  },
  {
    capability: 'Urgent report pop-up',
    actions: ['breakdown.urgent_alert'],
    cells: ['X', '', '', '', '', '', '', '', '', ''],
  },
  {
    capability: 'Inspection on the phone',
    actions: ['inspection.perform'],
    cells: ['', 'X', '', '', '', '', '', 'X', '', ''],
  },
  {
    capability: 'Driver menu',
    actions: ['driver.menu'],
    cells: ['', '', '', '', '', '', '', 'X', '', ''],
  },
  {
    capability: 'Goods Receipt, GR correction, parts master, stock opname',
    actions: ['inventory.manage'],
    cells: ['', '', 'X', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Receive tyres, retread, worn out, scrap, tyre count',
    actions: ['tyre.manage'],
    cells: ['', '', 'X', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Approve stock opname and tyre count',
    actions: ['count.approve'],
    cells: ['S', '', '', 'XL', 'XL', 'XL', '', '', '', ''],
  },
  {
    capability: 'Place and move schedule cards',
    view: 'schedule.view',
    actions: ['schedule.manage'],
    cells: ['X', '', '', '', '', 'X', '', '', 'V', ''],
  },
  {
    capability: 'View the schedule',
    view: 'schedule.view',
    cells: ['X', 'V', 'V', 'V', 'V', 'X', '', '', 'V', ''],
  },
  {
    capability: 'View vehicles, documents and the placement map',
    view: 'vehicle.view',
    cells: ['V', 'V', 'V', 'V', 'V', 'X', '', '', 'V', 'V'],
  },
  {
    capability: 'Part age and early-failure alerts',
    view: 'partage.view',
    cells: ['V', '', '', 'V', 'V', 'V', '', '', '', ''],
  },
  {
    capability: 'Customers and invoices',
    view: 'invoice.view',
    actions: ['invoice.manage'],
    cells: ['', '', '', 'X', 'V', 'X', '', '', '', 'X'],
  },
  {
    capability: 'Reports',
    view: 'report.view',
    cells: ['V', '', 'V', 'V', 'V', 'V', '', '', '', 'V'],
  },
  {
    capability: 'Manage accounts, roles, permissions; move System Admin',
    actions: ['accounts.manage'],
    cells: ['', '', '', '', '', 'L', 'XL', '', '', ''],
  },
  {
    capability: 'Switch Planner approval on or off',
    actions: ['iam.planner_approval_switch'],
    cells: ['', '', '', '', '', 'L', 'XL', '', '', ''],
  },
  {
    capability: 'Audit log',
    view: 'audit.view',
    cells: ['', '', '', '', 'V', 'V', 'V', '', '', ''],
  },
  {
    capability: 'AI assistant settings',
    actions: ['ai.settings'],
    cells: ['', '', '', '', '', 'X', '', '', '', ''],
  },
  {
    capability: 'Setup mode data entry without approval; Go live',
    actions: ['setup.golive'],
    cells: ['-', '-', '-', '-', '-', 'XL', '-', '-', '-', '-'],
  },
  {
    capability: 'Assign or reassign a step',
    actions: ['step.assign'],
    cells: ['X', '-', '-', '-', '-', 'X', '-', '-', '-', '-'],
  },
  {
    capability: 'Set the driver of a vehicle',
    actions: ['vehicle.driver_set'],
    cells: ['-', '-', '-', '-', '-', 'X', '-', '-', 'X', '-'],
  },
];

/** 2.4 and DEC-115: not a row; the executor roles hold it. */
export const FILES_UPLOAD_ROLES: readonly Role[] = [
  'Planner',
  'Mechanic',
  'Warehouse_Manager',
  'System_Admin',
  'Driver',
  'Field_Coordinator',
];

export interface RolePermissionSeed {
  role: Role;
  permissionCode: PermissionCode;
  allowed: boolean;
  isLocked: boolean;
}

interface Grant {
  allowed: boolean;
  locked: boolean;
}

/** Codes a role's cells grant, and whether the cell itself is locked (L, XL) or switchable (S). */
function cellGrants(role: Role): Map<PermissionCode, Grant> {
  const column = MATRIX_ROLES.indexOf(role as (typeof MATRIX_ROLES)[number]);
  const grants = new Map<PermissionCode, Grant>();
  const grant = (code: PermissionCode, allowed: boolean, locked: boolean) => {
    const previous = grants.get(code);
    grants.set(code, {
      allowed: allowed || (previous?.allowed ?? false),
      locked: locked || (previous?.locked ?? false),
    });
  };
  for (const row of PERMISSION_MATRIX) {
    const cell = row.cells[column];
    const actions = row.actions ?? [];
    if (cell === 'V' && row.view) grant(row.view, true, false);
    if (cell === 'X' || cell === 'XL') {
      if (row.view) grant(row.view, true, cell === 'XL');
      for (const code of actions) grant(code, true, cell === 'XL');
    }
    if (cell === 'S' || cell === 'L') for (const code of actions) grant(code, false, true);
  }
  if (FILES_UPLOAD_ROLES.includes(role)) grant('files.upload', true, false);
  return grants;
}

const AM_OWN_CODES: readonly PermissionCode[] = [
  'accounts.manage',
  'iam.planner_approval_switch',
  'audit.view',
];

/** DEC-115: the cells a business rule fixes, besides the L and S cells of the matrix. */
function lockedByRoleRule(
  role: Role,
  code: PermissionCode,
  ownCells: ReadonlySet<PermissionCode>,
): boolean {
  switch (role) {
    case 'System_Admin':
      return true; // REQ-IAM-005, RL-4: the whole column
    case 'Access_Manager':
      return !AM_OWN_CODES.includes(code); // RL-5
    case 'Field_Coordinator':
      return !isViewCode(code) && !ownCells.has(code); // RL-6
    case 'Accounting':
      return !isViewCode(code) && code !== 'invoice.manage'; // RL-9
    default:
      return false;
  }
}

/** The default `role_permissions` rows: every role × every catalogue code (2.2, 2.4, DEC-115). */
export function defaultRolePermissions(): RolePermissionSeed[] {
  return MATRIX_ROLES.flatMap((role) => {
    const grants = cellGrants(role);
    const ownCells = new Set([...grants].filter(([, g]) => g.allowed).map(([code]) => code));
    return PERMISSION_CODES.map((permissionCode) => {
      const cell = grants.get(permissionCode);
      return {
        role,
        permissionCode,
        allowed: cell?.allowed ?? false,
        isLocked: (cell?.locked ?? false) || lockedByRoleRule(role, permissionCode, ownCells),
      };
    });
  });
}

const BLOCKED_IN_SETUP: readonly PermissionCode[] = [
  'stock.issue',
  'purchase.line',
  'changerequest.raise',
  'schedule.manage',
  'invoice.manage',
  'count.approve',
];

/** 2.4: Setup mode blocks `spk.*`, `step.*`, `*.execute` and the codes above (REQ-IAM-010). */
export function blockedInSetupMode(code: PermissionCode): boolean {
  return (
    code.startsWith('spk.') ||
    code.startsWith('step.') ||
    code.endsWith('.execute') ||
    BLOCKED_IN_SETUP.includes(code)
  );
}

export type MenuKey =
  | 'dashboard'
  | 'spk'
  | 'breakdown'
  | 'schedule'
  | 'approvals'
  | 'inventory'
  | 'vehicles'
  | 'documents'
  | 'invoices'
  | 'customers'
  | 'reports'
  | 'settings'
  | 'users'
  | 'audit'
  | 'setup';

export interface MenuEntry {
  key: MenuKey;
  label: string;
  /** Shown when the user holds at least one of these (NAV-9). */
  anyOf: readonly PermissionCode[];
  /** Setup and go live shows only while the system is in Setup mode. */
  setupModeOnly?: boolean;
}

/** 2.4 menu table, in the rail's order (ui.md 7.2). */
export const MENU: readonly MenuEntry[] = [
  { key: 'dashboard', label: 'Dashboard', anyOf: ['dashboard.view'] },
  { key: 'spk', label: 'Surat Perintah Kerja', anyOf: ['spk.view'] },
  { key: 'breakdown', label: 'Report Breakdown', anyOf: ['breakdown.view'] },
  { key: 'schedule', label: 'Schedule', anyOf: ['schedule.view', 'schedule.manage'] },
  { key: 'approvals', label: 'Approvals', anyOf: ['spk.approve', 'count.approve'] },
  { key: 'inventory', label: 'Inventory', anyOf: ['inventory.manage', 'tyre.manage'] },
  { key: 'vehicles', label: 'Vehicles', anyOf: ['vehicle.view', 'vehicle.manage'] },
  { key: 'documents', label: 'Documents', anyOf: ['vehicle.view', 'vehicle.manage'] },
  { key: 'invoices', label: 'Invoices', anyOf: ['invoice.view', 'invoice.manage'] },
  { key: 'customers', label: 'Customers', anyOf: ['invoice.view', 'invoice.manage'] },
  { key: 'reports', label: 'Reports', anyOf: ['report.view'] },
  {
    key: 'settings',
    label: 'Settings',
    anyOf: ['registry.manage', 'parttype.manage', 'masterdata.manage', 'settings.manage'],
  },
  { key: 'users', label: 'Users and roles', anyOf: ['accounts.manage'] },
  { key: 'audit', label: 'Audit log', anyOf: ['audit.view'] },
  { key: 'setup', label: 'Setup and go live', anyOf: ['setup.golive'], setupModeOnly: true },
];

export type SystemMode = 'Setup' | 'Live';

/** NAV-9: the items whose codes the user holds; never chosen from the role name. */
export function menuFor(capabilities: ReadonlySet<PermissionCode>, mode: SystemMode): MenuEntry[] {
  return MENU.filter(
    (item) =>
      item.anyOf.some((code) => capabilities.has(code)) &&
      (!item.setupModeOnly || mode === 'Setup'),
  );
}
