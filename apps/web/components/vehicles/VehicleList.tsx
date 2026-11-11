'use client';

import type { Vehicle, VehicleListResponse, VehicleStatus } from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { VehiclesApi } from '../../lib/vehicles-api';
import { DataTable, type Column } from '../kit/DataTable';
import { Icon } from '../kit/Icon';
import { Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';
import { Tabs } from '../kit/Tabs';
import { PageHead } from '../shell/AppShell';
import { km, STATUS_TONES } from './vehicle-format';

/**
 * REQ-VEH-001: the fleet list, the same for every role that can see vehicles. DEC-122: the
 * Customer, Driver and alert count columns come with their tasks (TASK-701, TASK-606, TASK-607).
 */
const COLUMNS: Column<Vehicle>[] = [
  {
    key: 'plate',
    label: 'Plate',
    value: (v) => v.licensePlate,
    searchable: true,
    render: (v) => (
      <a className="b nowrap" href={`/vehicles/${v.id}`}>
        {v.licensePlate}
      </a>
    ),
  },
  { key: 'class', label: 'Class', value: (v) => v.vehicleClass.name, searchable: true },
  {
    key: 'odometer',
    label: 'Odometer',
    // REQ-PLC-018: a towed unit has no odometer.
    value: (v) => (v.vehicleClass.unitKind === 'Towed' ? '—' : km(v.currentOdometer)),
  },
  {
    key: 'status',
    label: 'Status',
    value: (v) => v.status,
    render: (v) => <StatusPill tone={STATUS_TONES[v.status]}>{v.status}</StatusPill>,
  },
];

/** The tabs in the order of the Vehicles artboard. */
const TAB_ORDER: VehicleStatus[] = ['Active', 'Repair', 'OFF', 'Blocked', 'Inactive'];

export function VehicleList({
  api,
  navigate,
}: {
  api: VehiclesApi;
  navigate: (path: string) => void;
}) {
  const [page, setPage] = useState<VehicleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.list().then((outcome) => {
      if (outcome.ok) setPage(outcome.data);
      else setError(outcome.message);
    });
  }, [api]);

  const table = (rows: Vehicle[]) => (
    <DataTable
      rows={rows}
      columns={COLUMNS}
      rowKey={(v) => String(v.id)}
      onSelect={(v) => navigate(`/vehicles/${v.id}`)}
    />
  );

  return (
    <>
      <PageHead
        title="Vehicles"
        actions={
          page?.allowedActions.includes('create') && (
            <a className="btn btn-primary" href="/vehicles/new">
              <Icon name="plus" size={16} />
              Add vehicle
            </a>
          )
        }
      />
      <Refusal message={error} />
      {page && (
        <Tabs
          tabs={[
            {
              key: 'all',
              label: 'All',
              count: page.vehicles.length,
              content: table(page.vehicles),
            },
            ...TAB_ORDER.map((status) => ({
              key: status,
              label: status,
              content: table(page.vehicles.filter((v) => v.status === status)),
            })),
          ]}
        />
      )}
    </>
  );
}
