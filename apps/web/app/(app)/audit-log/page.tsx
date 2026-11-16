import { AUDIT_AREAS, type AuditArea } from '@bmi/shared';
import { AuditLogPage } from '../../../components/access/AuditLogPage';

// REQ-IAM-007, DEC-131: the Audit log (audit.view); ?area= opens it on one area (FLW-AM-05).
export default async function AuditLogRoute({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;
  const known = (AUDIT_AREAS as readonly string[]).includes(area ?? '');
  return <AuditLogPage {...(known ? { area: area as AuditArea } : {})} />;
}
