'use client';

import { useMemo } from 'react';
import { plannerApprovalApi } from '../../lib/planner-approval-api';
import { rolePermissionsApi } from '../../lib/role-permissions-api';
import { PlannerApprovalCard } from './PlannerApprovalCard';
import { RolesPermissions } from './RolesPermissions';

/** Roles and permissions wired to the API of the browser. */
export function RolesPermissionsPage() {
  const api = useMemo(() => rolePermissionsApi(), []);
  const switchApi = useMemo(() => plannerApprovalApi(), []);
  return <RolesPermissions api={api} switchCard={<PlannerApprovalCard api={switchApi} />} />;
}
