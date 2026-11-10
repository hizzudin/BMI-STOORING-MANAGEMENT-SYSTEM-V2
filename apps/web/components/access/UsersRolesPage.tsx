'use client';

import { useMemo } from 'react';
import { accountsApi } from '../../lib/accounts-api';
import { UsersRoles } from './UsersRoles';

/** Users and roles wired to the API of the browser. */
export function UsersRolesPage() {
  const api = useMemo(() => accountsApi(), []);
  return <UsersRoles api={api} />;
}
