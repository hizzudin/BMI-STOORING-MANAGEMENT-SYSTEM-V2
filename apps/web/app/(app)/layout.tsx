import type { ReactNode } from 'react';
import { AppFrame } from '../../components/shell/AppFrame';

// Every page behind the sign-in shares the shell; its menu comes from GET /me (NAV-9).
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
