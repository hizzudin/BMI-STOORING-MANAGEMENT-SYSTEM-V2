'use client';

import { useMemo } from 'react';
import { systemModeApi } from '../../lib/system-mode-api';
import { SetupGoLive } from './SetupGoLive';

/**
 * SetupGoLive wired to the API of the browser. After a switch the page loads again, so the shell
 * asks GET /me once more and the menu follows the new mode (NAV-9).
 */
export function SetupPage() {
  const api = useMemo(() => systemModeApi(), []);
  return <SetupGoLive api={api} onSwitched={() => window.location.assign('/setup')} />;
}
