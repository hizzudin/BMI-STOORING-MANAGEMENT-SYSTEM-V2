import {
  APPROVAL_KIND_LABELS,
  formatTimeWib,
  wibCalendarDay,
  type ApprovalKind,
  type AuditArea,
} from '@bmi/shared';

/**
 * DEC-131: the area of each entity the services write to the audit log. A later task that writes a
 * new entity adds it here; the unit test fails while an entity written in src/ has no area.
 */
export const AREA_OF: Readonly<Record<string, AuditArea>> = {
  spk: 'SPK',
  user: 'Access',
  role_permissions: 'Access',
  planner_approval: 'Access',
  vehicle: 'Vehicles',
  vehicle_class: 'Vehicles',
  document_type: 'Settings',
};

/** The entities of one area: the Area filter as the database reads it. */
export const entitiesOf = (area: AuditArea): string[] =>
  Object.entries(AREA_OF)
    .filter(([, of]) => of === area)
    .map(([entity]) => entity);

/** Entities with a single record of their own, named instead of shown by id. */
const RECORD_NAMES: Readonly<Record<string, string>> = {
  planner_approval: 'Planner approval',
  role_permissions: 'Roles and permissions',
};

/** REQ-IAM-007 Record: the record's own name (SPK number, plate, account name, code), else its id. */
export function recordOf(row: { entity: string; entityId: number; recordName: string | null }) {
  return row.recordName ?? RECORD_NAMES[row.entity] ?? `${row.entity} #${row.entityId}`;
}

const SUMMARY_FIELDS = 3;
const SUMMARY_LENGTH = 120;

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.map(valueText).join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

const cut = (text: string) =>
  text.length > SUMMARY_LENGTH ? `${text.slice(0, SUMMARY_LENGTH - 1)}…` : text;

const fields = (record: Record<string, unknown>, keys: string[]) =>
  cut(keys.map((key) => `${key}: ${valueText(record[key])}`).join(', '));

/**
 * DEC-131 Before and After: the status when it changes; otherwise the changed top-level fields, at
 * most 3; a new record shows what it holds.
 */
export function summarise(
  before: unknown,
  after: unknown,
): { before: string | null; after: string | null } {
  const from = asObject(before);
  const to = asObject(after);
  if (
    typeof from?.status === 'string' &&
    typeof to?.status === 'string' &&
    from.status !== to.status
  ) {
    return { before: from.status, after: to.status };
  }
  if (!from || !to) {
    const only = to ?? from;
    const text = only ? fields(only, Object.keys(only).slice(0, SUMMARY_FIELDS)) : null;
    return to ? { before: null, after: text } : { before: text, after: null };
  }
  const changed = [...new Set([...Object.keys(from), ...Object.keys(to)])]
    .filter((key) => JSON.stringify(from[key]) !== JSON.stringify(to[key]))
    .slice(0, SUMMARY_FIELDS);
  if (changed.length === 0) return { before: null, after: null };
  return { before: fields(from, changed), after: fields(to, changed) };
}

const roleText = (role: unknown) =>
  typeof role === 'string' ? role.replace(/_/g, ' ') : 'no role';

function untilText(until: unknown, at: Date): string {
  if (typeof until !== 'string') return 'until it is switched off';
  const end = new Date(until);
  const time = formatTimeWib(end).slice(0, 5);
  return wibCalendarDay(end) === wibCalendarDay(at)
    ? `until ${time}`
    : `until ${wibCalendarDay(end)} ${time}`;
}

const kindsText = (kinds: unknown) =>
  (Array.isArray(kinds) ? kinds : [])
    .map((kind) => APPROVAL_KIND_LABELS[kind as ApprovalKind] ?? String(kind))
    .join(', ');

const ACCOUNT_VERBS: Readonly<Record<string, string>> = {
  edit: 'Edited the account',
  deactivate: 'Deactivated the account',
  activate: 'Activated the account',
  unlock: 'Unlocked the account',
  reset_password: 'Reset the password of',
};

export interface AccessChangeRow {
  entity: string;
  entityId: number;
  action: string;
  before: unknown;
  after: unknown;
  at: Date;
}

function plannerApprovalChange(row: AccessChangeRow): string {
  const after = asObject(row.after) ?? {};
  const on = `${untilText(after.until, row.at)} (${kindsText(after.kinds)})`;
  if (row.action === 'switch_on') return `Planner approval on ${on}`;
  if (row.action === 'change') return `Planner approval changed: on ${on}`;
  if (row.action === 'switch_off') return 'Planner approval off';
  return 'Planner approval ended at its end time';
}

function accountChange(row: AccessChangeRow, names: ReadonlyMap<number, string>): string {
  const before = asObject(row.before) ?? {};
  const after = asObject(row.after) ?? {};
  const name = valueText(after.name ?? before.name);
  if (row.action === 'move_system_admin') {
    const nameOf = (id: unknown) =>
      (typeof id === 'number' ? names.get(id) : undefined) ?? 'nobody';
    return `Moved System Admin from ${nameOf(before.systemAdminId)} to ${nameOf(after.systemAdminId)}`;
  }
  if (row.action === 'create') {
    return after.role
      ? `Created the account ${name} (${roleText(after.role)})`
      : `Created the account ${name}`;
  }
  if (row.action === 'role_change') {
    return `Changed the role of ${name} from ${roleText(before.role)} to ${roleText(after.role)}`;
  }
  const verb = ACCOUNT_VERBS[row.action];
  return verb ? `${verb} ${name}` : `${row.action} on the account ${name}`;
}

function permissionChange(row: AccessChangeRow): string {
  const cells = Object.entries(asObject(row.after) ?? {}).flatMap(([role, codes]) =>
    Object.entries(asObject(codes) ?? {}).map(
      ([code, allowed]) => `${roleText(role)} ${code} ${allowed ? 'on' : 'off'}`,
    ),
  );
  const more = cells.length - SUMMARY_FIELDS;
  const listed = cells.slice(0, SUMMARY_FIELDS).join('; ');
  return `Changed permissions: ${listed}${more > 0 ? ` and ${more} more` : ''}`;
}

/** FLW-AM-05 What: one access change in words; `names` resolves the account ids it mentions. */
export function accessChange(row: AccessChangeRow, names: ReadonlyMap<number, string>): string {
  if (row.entity === 'planner_approval') return plannerApprovalChange(row);
  if (row.entity === 'user') return accountChange(row, names);
  if (row.entity === 'role_permissions') return permissionChange(row);
  return `${row.action} on ${row.entity} #${row.entityId}`;
}

/** The account ids an access change mentions besides its own record (the System Admin move). */
export function mentionedUserIds(row: { action: string; before: unknown; after: unknown }) {
  if (row.action !== 'move_system_admin') return [];
  return [asObject(row.before)?.systemAdminId, asObject(row.after)?.systemAdminId].filter(
    (id): id is number => typeof id === 'number',
  );
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** DEC-74: one CSV cell; a cell that a spreadsheet would read as a formula is written as text. */
function csvCell(value: string): string {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** DEC-74: RFC 4180 with CRLF, UTF-8 with a BOM so a spreadsheet reads the accents. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
