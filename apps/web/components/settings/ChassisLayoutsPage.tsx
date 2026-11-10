'use client';

import { useMemo } from 'react';
import { vehicleClassesApi } from '../../lib/vehicle-classes-api';
import { ChassisLayouts } from './ChassisLayouts';

/** Vehicle classes and chassis layouts wired to the API of the browser. */
export function ChassisLayoutsPage() {
  const api = useMemo(() => vehicleClassesApi(), []);
  return <ChassisLayouts api={api} />;
}
