import { SPK_TABS, type SpkTab } from '@bmi/shared';
import { SpkListPage } from '../../../components/spk/SpkPages';

// REQ-SPK-010, DEC-127: SPKList; DEC-129: ?tab= opens a tab (Cancel SPK lands on Cancelled).
export default async function SpkRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const known = (SPK_TABS as readonly string[]).includes(tab ?? '');
  return <SpkListPage {...(known ? { tab: tab as SpkTab } : {})} />;
}
