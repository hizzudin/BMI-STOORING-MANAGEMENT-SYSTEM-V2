'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { authApi } from '../../lib/auth-api';
import { notificationsApi } from '../../lib/notifications-api';
import { SignedInShell } from './SignedInShell';

/** The signed-in shell wired to the router and the API of the browser. */
export function AppFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const api = useMemo(() => authApi(), []);
  const notices = useMemo(() => notificationsApi(), []);
  const navigate = useMemo(() => (path: string) => router.replace(path), [router]);
  return (
    <SignedInShell api={api} navigate={navigate} pathname={pathname} notices={notices}>
      {children}
    </SignedInShell>
  );
}
