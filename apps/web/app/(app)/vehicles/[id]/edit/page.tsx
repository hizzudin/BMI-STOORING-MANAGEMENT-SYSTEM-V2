import { EditVehiclePage } from '../../../../../components/vehicles/VehiclePages';

// REQ-VEH-003, REQ-VEH-004: Edit vehicle with its Deactivate dialog (vehicle.manage).
export default async function EditVehicleRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditVehiclePage id={Number(id)} />;
}
