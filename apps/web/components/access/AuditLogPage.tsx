'use client';

import type { AuditArea } from '@bmi/shared';
import { useMemo } from 'react';
import { auditApi } from '../../lib/audit-api';
import { AccessHistory } from './AccessHistory';
import { AuditLog } from './AuditLog';

/** The Audit log wired to the API of the browser. */
export function AuditLogPage({ area }: { area?: AuditArea }) {
  const api = useMemo(() => auditApi(), []);
  return <AuditLog api={api} {...(area ? { initialArea: area } : {})} />;
}

/** Users and roles › Access history wired to the API of the browser. */
export function AccessHistoryPage() {
  const api = useMemo(() => auditApi(), []);
  return <AccessHistory api={api} />;
}
