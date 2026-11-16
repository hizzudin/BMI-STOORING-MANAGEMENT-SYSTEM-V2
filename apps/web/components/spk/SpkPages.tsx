'use client';

import type { SpkTab } from '@bmi/shared';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { spksApi } from '../../lib/spks-api';
import { CreateSpk } from './CreateSpk';
import { SpkDetail } from './SpkDetail';
import { SpkList } from './SpkList';

function useWiring() {
  const router = useRouter();
  const api = useMemo(() => spksApi(), []);
  const navigate = useMemo(() => (path: string) => router.push(path), [router]);
  return { api, navigate };
}

/** The SPK pages wired to the API of the browser. */
export function SpkListPage({ tab }: { tab?: SpkTab }) {
  return <SpkList api={useWiring().api} {...(tab ? { initialTab: tab } : {})} />;
}

export function SpkDetailPage({ id }: { id: number }) {
  return <SpkDetail {...useWiring()} id={id} />;
}

export function NewSpkPage({ vehicleId }: { vehicleId: number | null }) {
  return <CreateSpk {...useWiring()} mode={{ kind: 'new', vehicleId }} />;
}

export function EditSpkPage({ id, saved }: { id: number; saved: boolean }) {
  return <CreateSpk {...useWiring()} mode={{ kind: 'edit', id, saved }} />;
}
