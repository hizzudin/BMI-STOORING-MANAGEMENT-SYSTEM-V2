import type { ReactNode } from 'react';
import { UploadProvider } from '../../components/files/UploadProvider';
import { AppFrame } from '../../components/shell/AppFrame';

// Every page behind the sign-in shares the shell; its menu comes from GET /me (NAV-9).
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppFrame>
      {/* DEC-139: one upload queue above every screen, so uploads go on across navigation. */}
      <UploadProvider>{children}</UploadProvider>
    </AppFrame>
  );
}
