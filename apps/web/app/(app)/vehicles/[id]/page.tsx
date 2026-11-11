import { VehicleDetailPage } from '../../../../components/vehicles/VehiclePages';

// REQ-VEH-001: one vehicle with its Overview and Chassis and parts tabs.
export default async function VehicleRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetailPage id={Number(id)} />;
}
