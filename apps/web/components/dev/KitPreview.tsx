'use client';

import { useState } from 'react';
import { Button } from '../kit/Button';
import { ConfirmDialog } from '../kit/ConfirmDialog';
import { StatusPill } from '../kit/StatusPill';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { SettingsHome } from '../settings/SettingsHome';
import { AppShell, PageHead, type NavItem } from '../shell/AppShell';

/**
 * Development-only gallery of the TASK-126 shell and kit, used to compare them with their artboards.
 * The rail lists every item of the ui.md 7.2 menu so the look can be checked; the real menu comes from
 * the user's capabilities in TASK-106 (NAV-9) and this page is not served in production.
 */
const ALL_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '#dashboard', icon: 'dashboard' },
  { key: 'spk', label: 'Surat Perintah Kerja', href: '#spk', icon: 'spk', count: 3 },
  { key: 'breakdown', label: 'Report Breakdown', href: '#breakdown', icon: 'breakdown', count: 2 },
  { key: 'schedule', label: 'Schedule', href: '#schedule', icon: 'schedule' },
  { key: 'approvals', label: 'Approvals', href: '#approvals', icon: 'approvals' },
  { key: 'inventory', label: 'Inventory', href: '#inventory', icon: 'inventory' },
  { key: 'vehicles', label: 'Vehicles', href: '#vehicles', icon: 'vehicles' },
  { key: 'documents', label: 'Documents', href: '#documents', icon: 'documents' },
  { key: 'reports', label: 'Reports', href: '#reports', icon: 'reports' },
  { key: 'settings', label: 'Settings', href: '#settings', icon: 'settings' },
];

type Dialog = 'none' | 'discard' | 'deactivate';

export function KitPreview() {
  const [collapsed, setCollapsed] = useState(true);
  const [dialog, setDialog] = useState<Dialog>('none');
  const guard = useLeaveGuard();

  return (
    <AppShell
      items={ALL_ITEMS}
      activeKey="settings"
      user={{ name: 'Preview User', role: 'Planner', email: 'preview@example.test' }}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      unreadNotifications={2}
    >
      <SettingsHome />
      <section>
        <PageHead
          title="Kit"
          crumb="Development preview"
          actions={<StatusPill tone="info">Preview</StatusPill>}
        />
        <div className="head">
          <Button onClick={() => guard.setDirty(true)}>Type something</Button>
          <Button onClick={() => guard.leave(() => guard.setDirty(false))}>Leave page</Button>
          <Button onClick={() => setDialog('discard')}>Discard changes</Button>
          <Button variant="danger" onClick={() => setDialog('deactivate')}>
            Deactivate
          </Button>
          <Button variant="primary">Save</Button>
        </div>
      </section>
      {guard.dialog}
      {dialog === 'discard' && (
        <ConfirmDialog
          title="Discard your changes?"
          body="The page goes back to the last saved version."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => setDialog('none')}
          onCancel={() => setDialog('none')}
        />
      )}
      {dialog === 'deactivate' && (
        <ConfirmDialog
          title="Deactivate this record?"
          body="No new SPK lines can use it; saved lines keep it."
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          onConfirm={() => setDialog('none')}
          onCancel={() => setDialog('none')}
        />
      )}
    </AppShell>
  );
}
