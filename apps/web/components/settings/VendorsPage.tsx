'use client';

import { useMemo } from 'react';
import { vendorsApi } from '../../lib/vendors-api';
import { Vendors } from './Vendors';

/** The vendor master wired to the API of the browser. */
export function VendorsPage() {
  const api = useMemo(() => vendorsApi(), []);
  return <Vendors api={api} />;
}
