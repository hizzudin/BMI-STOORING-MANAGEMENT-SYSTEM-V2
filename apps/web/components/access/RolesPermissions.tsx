'use client';

import {
  MATRIX_ROLES,
  PERMISSION_GROUPS,
  PERMISSION_MEANINGS,
  type PermissionCode,
  type Role,
  type RolePermissionCell,
  type RolePermissionsResponse,
} from '@bmi/shared';
import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { RolePermissionsApi } from '../../lib/role-permissions-api';
import { Button } from '../kit/Button';
import { StatusPill } from '../kit/StatusPill';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { PageHead } from '../shell/AppShell';
import { AccessTabs } from './AccessTabs';
import { roleLabel } from './UsersRoles';

/** Column heads of the 2.2 matrix, short enough for ten columns. */
const HEAD: Record<(typeof MATRIX_ROLES)[number], string> = {
  Planner: 'Planner',
  Mechanic: 'Mechanic',
  Warehouse_Manager: 'Warehouse',
  Supervisor: 'Supervisor',
  GM: 'GM',
  System_Admin: 'System Admin',
  Access_Manager: 'Access Mgr.',
  Driver: 'Driver',
  Field_Coordinator: 'Field Coord.',
  Accounting: 'Accounting',
};

const keyOf = (role: Role, code: PermissionCode) => `${role}|${code}`;

/** The fixed text of a cell the Access Manager cannot change: ✓ L, L or S (2.2). */
function fixedText(cell: RolePermissionCell): string {
  if (cell.switchable) return 'S';
  return cell.allowed ? '✓ L' : 'L';
}

/** AMRolesPermissions (REQ-IAM-005, DEC-117): the 2.4 codes × the ten roles; locked cells stay. */
export function RolesPermissions({
  api,
  switchCard,
}: {
  api: RolePermissionsApi;
  /** The Planner approval card above the matrix (REQ-IAM-008, TASK-109). */
  switchCard?: ReactNode;
}) {
  const [matrix, setMatrix] = useState<RolePermissionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Staged cells: key → the new value; the matrix keeps the saved one. */
  const [staged, setStaged] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useLeaveGuard();
  const { setDirty } = guard;

  const load = useCallback(async () => {
    const outcome = await api.get();
    if (outcome.ok) setMatrix(outcome.data);
    else setLoadError(outcome.message);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setDirty(staged.size > 0), [staged, setDirty]);

  const head = (
    <>
      <PageHead title="Users and roles" />
      <AccessTabs current="roles" />
      {switchCard}
    </>
  );

  if (loadError) {
    return (
      <>
        {head}
        <p className="refusal" role="alert">
          {loadError}
        </p>
      </>
    );
  }
  if (!matrix) return head;

  const cells = new Map(matrix.cells.map((cell) => [keyOf(cell.role, cell.permissionCode), cell]));
  const editable = matrix.allowedActions.includes('edit');

  const toggle = (cell: RolePermissionCell) => {
    const key = keyOf(cell.role, cell.permissionCode);
    const next = new Map(staged);
    const value = !(staged.get(key) ?? cell.allowed);
    if (value === cell.allowed) next.delete(key);
    else next.set(key, value);
    setStaged(next);
    setError(null);
  };

  /** DEC-117: every staged cell in one request; a refusal keeps them staged. */
  const save = async () => {
    const changes = [...staged].map(([key, allowed]) => {
      const [role, permissionCode] = key.split('|') as [Role, PermissionCode];
      return { role, permissionCode, allowed };
    });
    setBusy(true);
    const outcome = await api.change(changes);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    setMatrix(outcome.data);
    setStaged(new Map());
    setError(null);
  };

  const renderCell = (role: (typeof MATRIX_ROLES)[number], code: PermissionCode) => {
    const cell = cells.get(keyOf(role, code));
    if (!cell) return <td key={role} />;
    const label = `${roleLabel(role)}: ${code}`;
    if (cell.isLocked || cell.switchable || !editable) {
      const text = cell.isLocked || cell.switchable ? fixedText(cell) : cell.allowed ? '✓' : '';
      return (
        <td key={role} className="cell">
          <span className="cell-fixed" aria-label={label}>
            {text}
          </span>
        </td>
      );
    }
    const key = keyOf(role, code);
    const changed = staged.has(key);
    const value = staged.get(key) ?? cell.allowed;
    return (
      <td key={role} className={changed ? 'cell staged' : 'cell'}>
        <button
          type="button"
          className="cell-btn"
          aria-label={label}
          aria-pressed={value}
          onClick={() => toggle(cell)}
        >
          {value ? '✓' : ''}
        </button>
        {changed && <StatusPill tone="warning">changed</StatusPill>}
      </td>
    );
  };

  return (
    <>
      {head}
      <div className="table-wrap">
        <table className="table matrix">
          <thead>
            <tr>
              <th scope="col">Code</th>
              {MATRIX_ROLES.map((role) => (
                <th key={role} scope="col" className="cell">
                  {HEAD[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.label}>
                <tr className="group">
                  <td colSpan={MATRIX_ROLES.length + 1}>{group.label}</td>
                </tr>
                {group.codes.map((code) => (
                  <tr key={code}>
                    <th scope="row">
                      {code}
                      <div className="small muted">{PERMISSION_MEANINGS[code]}</div>
                    </th>
                    {MATRIX_ROLES.map((role) => renderCell(role, code))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {staged.size > 0 && (
        <div className="bar matrix-bar">
          <span className="small muted">
            {staged.size} {staged.size === 1 ? 'change' : 'changes'}
          </span>
          {error && (
            <p className="refusal" role="alert">
              {error}
            </p>
          )}
          <span className="grow" />
          <Button
            disabled={busy}
            onClick={() => {
              setStaged(new Map());
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} aria-busy={busy} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      )}
      {guard.dialog}
    </>
  );
}
