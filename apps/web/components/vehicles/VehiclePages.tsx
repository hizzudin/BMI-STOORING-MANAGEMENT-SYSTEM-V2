'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { vehiclesApi } from '../../lib/vehicles-api';
import { VehicleDetail } from './VehicleDetail';
import { VehicleForm } from './VehicleForm';
import { VehicleList } from './VehicleList';

function useWiring() {
  const router = useRouter();
  const api = useMemo(() => vehiclesApi(), []);
  const navigate = useMemo(() => (path: string) => router.push(path), [router]);
  return { api, navigate };
}

/** Vehicles wired to the API of the browser. */
export function VehicleListPage() {
  return <VehicleList {...useWiring()} />;
}

export function VehicleDetailPage({ id }: { id: number }) {
  return <VehicleDetail api={useWiring().api} id={id} />;
}

export function AddVehiclePage() {
  return <VehicleForm {...useWiring()} mode={{ kind: 'add' }} />;
}

export function EditVehiclePage({ id }: { id: number }) {
  return <VehicleForm {...useWiring()} mode={{ kind: 'edit', id }} />;
}
