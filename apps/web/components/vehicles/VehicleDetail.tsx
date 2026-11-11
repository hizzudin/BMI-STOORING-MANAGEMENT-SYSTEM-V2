'use client';

import { ChassisMap } from '@bmi/chassis-map';
import type { Vehicle } from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { VehiclesApi } from '../../lib/vehicles-api';
import { Icon } from '../kit/Icon';
import { Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';
import { Tabs } from '../kit/Tabs';
import { PageHead } from '../shell/AppShell';
import { km, noBaseline, STATUS_TONES } from './vehicle-format';

function ChassisCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="card white">
      <h2>
        <span className="circle-ic">
          <Icon name="tyre" size={18} />
        </span>
        Chassis
      </h2>
      <div className="map-card">
        <ChassisMap
          definition={vehicle.layout.definition}
          statuses={noBaseline(vehicle.layout.definition)}
          title={`Chassis map, ${vehicle.licensePlate}`}
        />
      </div>
    </div>
  );
}

/** The map in the wide column; the Part items and Status cards beside it come with TASK-511 and TASK-120. */
const ChassisTab = ({ vehicle }: { vehicle: Vehicle }) => (
  <div className="grid g2">
    <ChassisCard vehicle={vehicle} />
  </div>
);

/**
 * REQ-VEH-001: one vehicle with the Overview and Chassis and parts tabs; the map is read only.
 * DEC-122: the Documents, SPK history and Inspections tabs and the Parts baseline, Create SPK,
 * Record reading and Change driver buttons stay hidden until their tasks are done.
 */
export function VehicleDetail({ api, id }: { api: VehiclesApi; id: number }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get(id).then((outcome) => {
      if (outcome.ok) setVehicle(outcome.data.vehicle);
      else setError(outcome.message);
    });
  }, [api, id]);

  if (!vehicle) {
    return (
      <>
        <PageHead crumb="Vehicles" title="Vehicle" />
        <Refusal message={error} />
      </>
    );
  }

  const powered = vehicle.vehicleClass.unitKind === 'Powered';
  return (
    <>
      <PageHead
        crumb={`Vehicles / ${vehicle.licensePlate}`}
        title={vehicle.licensePlate}
        status={<StatusPill tone={STATUS_TONES[vehicle.status]}>{vehicle.status}</StatusPill>}
        actions={
          vehicle.allowedActions.includes('edit') && (
            <a className="btn btn-secondary" href={`/vehicles/${vehicle.id}/edit`}>
              Edit vehicle
            </a>
          )
        }
      />
      <p className="muted subline">
        {vehicle.vehicleClass.name}
        {/* REQ-PLC-018: a towed unit has no odometer. */}
        {powered && ` · ${km(vehicle.currentOdometer)}`}
      </p>
      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview', content: <ChassisTab vehicle={vehicle} /> },
          { key: 'chassis', label: 'Chassis and parts', content: <ChassisTab vehicle={vehicle} /> },
        ]}
      />
    </>
  );
}
