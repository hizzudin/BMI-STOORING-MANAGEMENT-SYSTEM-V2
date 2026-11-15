import { SpkDetailPage } from '../../../../components/spk/SpkPages';

// REQ-SPK-011, DEC-127: SPKDetail, read only.
export default async function SpkDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SpkDetailPage id={Number(id)} />;
}
