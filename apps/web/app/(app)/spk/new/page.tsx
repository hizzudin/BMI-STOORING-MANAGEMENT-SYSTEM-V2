import { NewSpkPage } from '../../../../components/spk/SpkPages';

// REQ-SPK-001, C-11: Create SPK, blank or with the vehicle of ?vehicle= (spk.create).
export default async function NewSpkRoute({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle } = await searchParams;
  const vehicleId = vehicle && /^\d+$/.test(vehicle) ? Number(vehicle) : null;
  return <NewSpkPage vehicleId={vehicleId} />;
}
