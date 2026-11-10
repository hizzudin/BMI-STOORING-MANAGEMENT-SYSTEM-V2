'use client';

import { useMemo } from 'react';
import { rolePermissionsApi } from '../../lib/role-permissions-api';
import { RolesPermissions } from './RolesPermissions';

/** Roles and permissions wired to the API of the browser. */
export function RolesPermissionsPage() {
  const api = useMemo(() => rolePermissionsApi(), []);
  return <RolesPermissions api={api} />;
}
