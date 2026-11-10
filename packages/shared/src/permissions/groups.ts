import type { Role } from '../enums/index.js';
import type { PermissionCode } from './index.js';

/** DEC-117: the rows of the Access Manager matrix, the 2.4 codes grouped by area. */
export const PERMISSION_GROUPS: readonly { label: string; codes: readonly PermissionCode[] }[] = [
  { label: 'Dashboard', codes: ['dashboard.view'] },
  { label: 'Surat Perintah Kerja', codes: ['spk.view', 'spk.create', 'spk.approve', 'spk.cancel'] },
  {
    label: 'Report Breakdown',
    codes: ['breakdown.view', 'breakdown.review', 'breakdown.send', 'breakdown.urgent_alert'],
  },
  {
    label: 'Steps and files',
    codes: [
      'stock.issue',
      'purchase.line',
      'mechanic.execute',
      'mobilisasi.execute',
      'docstep.execute',
      'step.verify',
      'step.request_completion',
      'step.assign',
      'changerequest.raise',
      'files.upload',
    ],
  },
  {
    label: 'Settings and master data',
    codes: [
      'registry.manage',
      'parttype.manage',
      'masterdata.manage',
      'settings.manage',
      'ai.settings',
    ],
  },
  {
    label: 'Vehicles',
    codes: [
      'vehicle.view',
      'vehicle.manage',
      'vehicle.driver_set',
      'odometer.manual',
      'inspection.proxy',
      'inspection.perform',
      'driver.menu',
      'partage.view',
    ],
  },
  { label: 'Inventory', codes: ['inventory.manage', 'tyre.manage', 'count.approve'] },
  { label: 'Schedule', codes: ['schedule.view', 'schedule.manage'] },
  { label: 'Billing', codes: ['invoice.view', 'invoice.manage'] },
  { label: 'Reports', codes: ['report.view'] },
  {
    label: 'Administration',
    codes: ['audit.view', 'accounts.manage', 'iam.planner_approval_switch', 'setup.golive'],
  },
];

/** DEC-117: what each code opens or allows, from the 2.4 catalogue. */
export const PERMISSION_MEANINGS: Readonly<Record<PermissionCode, string>> = {
  'dashboard.view': 'Role dashboard; mobile home',
  'spk.view': 'View Surat Perintah Kerja, list and detail',
  'spk.create': 'Create, edit and submit an SPK',
  'breakdown.view': 'Report Breakdown list',
  'breakdown.review': 'Create an SPK from a report, or reject it',
  'breakdown.send': 'Send a Report Breakdown',
  'breakdown.urgent_alert': 'Urgent report pop-up',
  'spk.approve': 'Approve or reject SPK creation, amendment, completion',
  'spk.cancel': 'Cancel an SPK',
  'stock.issue': 'Stock step: cut stock from the warehouse',
  'purchase.line': 'Part Purchase step: bought outside',
  'mechanic.execute': 'Execute Mechanic Action, Part Replacement and Part Check',
  'mobilisasi.execute': 'Execute a Mobilisasi step',
  'docstep.execute': 'Execute a Document step',
  'step.verify': 'Verify or return a step',
  'step.request_completion': 'Request completion approval',
  'step.assign': 'Assign or reassign a step',
  'changerequest.raise': 'Raise a change request',
  'files.upload': 'Upload photos and files',
  'registry.manage': 'Build SPK steps, maintain SPK presets and PM packages',
  'parttype.manage': 'Part item types: normal life and early-failure tolerance',
  'masterdata.manage': 'Other master data pages',
  'settings.manage': 'Tax, markup, OFF-unit rate, alert thresholds',
  'ai.settings': 'AI assistant settings',
  'vehicle.view': 'View vehicles, documents and the placement map',
  'vehicle.manage': 'Add, edit, deactivate vehicles; documents; baseline; odometer void',
  'vehicle.driver_set': 'Set the driver of a vehicle',
  'odometer.manual': 'Record a manual odometer reading',
  'inspection.proxy': 'Inspection and Report Breakdown for a driver',
  'inspection.perform': 'Inspection on the phone',
  'driver.menu': 'Driver menu: odometer and history on the phone',
  'partage.view': 'Part age and early-failure alerts',
  'inventory.manage': 'Goods Receipt, GR correction, parts master, stock opname',
  'tyre.manage': 'Receive tyres, retread, worn out, scrap, tyre count',
  'count.approve': 'Approve stock opname and tyre count',
  'schedule.view': 'View the schedule',
  'schedule.manage': 'Place and move schedule cards',
  'invoice.view': 'Customers and invoices, read only',
  'invoice.manage': 'Create, issue, print, mark paid, void; customers',
  'report.view': 'Reports',
  'audit.view': 'Audit log and its export',
  'accounts.manage': 'Manage accounts, roles, permissions; move System Admin',
  'iam.planner_approval_switch': 'Switch Planner approval on or off',
  'setup.golive': 'Setup mode data entry and Go live',
};

/** 2.2 S: the Planner approval cells, which only the Planner approval switch turns on (REQ-IAM-008). */
export function isSwitchableCell(role: Role, code: PermissionCode): boolean {
  return role === 'Planner' && (code === 'spk.approve' || code === 'count.approve');
}
