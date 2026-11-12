'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { spksApi } from '../../lib/spks-api';
import { CreateSpk } from './CreateSpk';
import { SpkHome } from './SpkHome';

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

export function NewSpkPage({ vehicleId }: { vehicleId: number | null }) {
  return <CreateSpk {...useWiring()} mode={{ kind: 'new', vehicleId }} />;
}

export function EditSpkPage({ id, saved }: { id: number; saved: boolean }) {
  return <CreateSpk {...useWiring()} mode={{ kind: 'edit', id, saved }} />;
}
