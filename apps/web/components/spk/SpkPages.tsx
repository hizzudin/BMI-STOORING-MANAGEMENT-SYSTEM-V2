'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { spksApi } from '../../lib/spks-api';
import { CreateSpk } from './CreateSpk';
import { SpkHome } from './SpkHome';
import { SpkList } from './SpkList';
import { SpkDetail } from './SpkDetail';

function useWiring() {
  const router = useRouter();
  const api = useMemo(() => spksApi(), []);
  const navigate = useMemo(() => (path: string) => router.push(path), [router]);
  return { api, navigate };
}

/** Create SPK wired to the API of the browser. */
export function SpkHomePage() {
  return <SpkHome api={useWiring().api} />;
}

/** SPK List page (TASK-125). */
export function SpkListPage() {
  return <SpkList api={useWiring().api} />;
}

/** SPK Detail page (TASK-125). */
export function SpkDetailPage() {
  return <SpkDetail api={useWiring().api} />;
}

export function NewSpkPage({ vehicleId }: { vehicleId: number | null }) {
  return <CreateSpk {...useWiring()} mode={{ kind: 'new', vehicleId }} />;
}

export function EditSpkPage({ id, saved }: { id: number; saved: boolean }) {
  return <CreateSpk {...useWiring()} mode={{ kind: 'edit', id, saved }} />;
}
