import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell, PageHead, type NavItem } from '../shell/AppShell';
import { SettingsHome } from '../settings/SettingsHome';
import { BusyButton, Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTable } from './DataTable';
import { StatusPill } from './StatusPill';
import { Tabs } from './Tabs';
import { useLeaveGuard } from './useLeaveGuard';

afterEach(cleanup);

const items: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { key: 'spk', label: 'Surat Perintah Kerja', href: '/spk', icon: 'spk', count: 3 },
];

describe('C-34 buttons while a request runs', () => {
  it('C-34 a busy button is disabled and shows progress, so it cannot be sent twice', async () => {
    let finish: () => void = () => undefined;
    const onClick = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<BusyButton onClick={onClick}>Submit</BusyButton>);
    const button = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    await act(async () => finish());
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('C-34 a refused request shows one sentence and keeps the form as typed', async () => {
    render(
      <BusyButton
        onClick={() => Promise.reject(new Error('A newer version was saved by someone else.'))}
      >
        Save
      </BusyButton>,
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(screen.getByRole('alert').textContent).toBe(
      'A newer version was saved by someone else.',
    );
  });

  it('DESIGN.md a danger button is outlined and says its verb', () => {
    render(<Button variant="danger">Deactivate</Button>);
    expect(screen.getByRole('button', { name: 'Deactivate' }).className).toContain('btn-danger');
  });
});

describe('NFR-10 status pills', () => {
  it('NFR-10 a status always carries its text label', () => {
    render(<StatusPill tone="danger">Blocked</StatusPill>);
    expect(screen.getByText('Blocked').className).toContain('pill-danger');
  });
});

describe('C-06 NAV-2 tabs', () => {
  it('C-06 NAV-2 a tab changes the content of the same page and shows its live count', () => {
    render(
      <Tabs
        tabs={[
          { key: 'all', label: 'All', count: 12, content: <p>All rows</p> },
          { key: 'mine', label: 'Mine', count: 2, content: <p>My rows</p> },
        ]}
      />,
    );
    expect(screen.getByText('All rows')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Mine/ }));
    expect(screen.getByText('My rows')).toBeTruthy();
    expect(screen.queryByText('All rows')).toBeNull();
    expect(screen.getByRole('tab', { name: /Mine/ }).textContent).toContain('2');
  });
});

describe('C-14 C-12 C-16 C-32 dialogs', () => {
  it('C-14 Cancel closes the dialog and nothing changes', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Leave without saving?"
        body="What you typed on this page is lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Leave without saving?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('C-14 Escape closes the dialog like Cancel', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Discard your changes?"
        body="x"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('C-32 the confirm button carries the explicit verb and the danger look', () => {
    render(
      <ConfirmDialog
        title="Deactivate PM 20.000 km service?"
        body="No new SPK lines can use this service; saved lines keep it."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Deactivate' }).className).toContain('btn-danger');
  });
});

describe('C-12 C-13 leaving with unsaved changes', () => {
  function Form({ onLeave }: { onLeave: () => void }) {
    const guard = useLeaveGuard();
    return (
      <>
        <input aria-label="Title" onChange={() => guard.setDirty(true)} />
        <button type="button" onClick={() => guard.leave(onLeave)}>
          Cancel
        </button>
        {guard.dialog}
      </>
    );
  }

  it('C-12 Cancel on a clean form leaves at once', () => {
    const onLeave = vi.fn();
    render(<Form onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('C-12 C-13 Cancel after typing asks Leave without saving? and Stay keeps the form', () => {
    const onLeave = vi.fn();
    render(<Form onLeave={onLeave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });
});

describe('NFR-08 C-33 tables', () => {
  const rows = [
    { code: 'SVC-020', name: 'PM 20.000 km service', price: 650000 },
    { code: 'SVC-095', name: 'Brake system check', price: 150000 },
    { code: 'SVC-010', name: 'Engine oil change', price: 150000 },
  ];
  const columns = [
    { key: 'code', label: 'Code', value: (r: (typeof rows)[number]) => r.code, searchable: true },
    {
      key: 'name',
      label: 'Service',
      value: (r: (typeof rows)[number]) => r.name,
      searchable: true,
    },
    { key: 'price', label: 'Price', value: (r: (typeof rows)[number]) => r.price },
  ];
  const cells = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

  it('NFR-08 every column is sortable', () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.code} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Code' }));
    expect(cells()).toEqual(['SVC-010', 'SVC-020', 'SVC-095']);
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Code' }));
    expect(cells()).toEqual(['SVC-095', 'SVC-020', 'SVC-010']);
  });

  it('C-33 search matches the code and name columns at once', () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.code} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'brake' } });
    expect(cells()).toEqual(['SVC-095']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'svc-01' } });
    expect(cells()).toEqual(['SVC-010']);
  });

  it('NFR-08 every column is filterable', () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.code} />);
    fireEvent.change(screen.getByLabelText('Filter Price'), { target: { value: '150' } });
    expect(cells()).toEqual(['SVC-095', 'SVC-010']);
  });

  it('C-07 a row click selects it on a master-detail page', () => {
    const onSelect = vi.fn();
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.code}
        onSelect={onSelect}
        selectedKey="SVC-095"
      />,
    );
    fireEvent.click(screen.getByText('Engine oil change'));
    expect(onSelect).toHaveBeenCalledWith(rows[2]);
    expect(
      screen.getByText('Brake system check').closest('tr')?.getAttribute('aria-selected'),
    ).toBe('true');
  });
});

describe('C-01 C-02 app shell', () => {
  it('C-02 DEC-82 the rail is collapsed by default and the choice is saved per user', () => {
    const onCollapsedChange = vi.fn();
    render(
      <AppShell
        items={items}
        activeKey="spk"
        user={{ name: 'Planner Sari', role: 'Planner' }}
        collapsed
        onCollapsedChange={onCollapsedChange}
      >
        <p>Main</p>
      </AppShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(nav.closest('[data-collapsed]')?.getAttribute('data-collapsed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('C-01 DEC-82 each item is a link with an icon and an accessible name, even when collapsed', () => {
    render(
      <AppShell
        items={items}
        activeKey="spk"
        user={{ name: 'Planner Sari', role: 'Planner' }}
        collapsed
        onCollapsedChange={vi.fn()}
      >
        <p>Main</p>
      </AppShell>,
    );
    const link = screen.getByRole('link', { name: /Surat Perintah Kerja/ });
    expect(link.getAttribute('href')).toBe('/spk');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link.textContent).toContain('3');
  });

  it('C-04 the user menu opens Change password, Notification settings and Sign out', () => {
    const onSignOut = vi.fn();
    render(
      <AppShell
        items={items}
        activeKey="spk"
        user={{ name: 'Planner Sari', role: 'Planner' }}
        collapsed
        onCollapsedChange={vi.fn()}
        onSignOut={onSignOut}
      >
        <p>Main</p>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Planner Sari, Planner' }));
    const menu = screen.getByRole('dialog', { name: 'Planner Sari' });
    expect(within(menu).getByRole('link', { name: 'Change password' }).getAttribute('href')).toBe(
      '/change-password',
    );
    fireEvent.click(within(menu).getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('C-04 C-14 the user menu shows email and role and closes by Close, Escape or the scrim', () => {
    render(
      <AppShell
        items={items}
        activeKey="spk"
        user={{ name: 'Planner Sari', role: 'Planner', email: 'sari@bmi.co.id' }}
        collapsed={false}
        onCollapsedChange={vi.fn()}
      >
        <p>Main</p>
      </AppShell>,
    );
    expect(
      screen.getByRole('button', { name: 'Collapse menu' }).getAttribute('aria-expanded'),
    ).toBe('true');
    const open = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Planner Sari, Planner' }));
    open();
    expect(screen.getByText('sari@bmi.co.id · Planner')).toBeTruthy();
    expect(
      within(screen.getByRole('dialog'))
        .getByRole('button', { name: 'Notification settings' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('DEC-94 a page head shows its crumb, and outside the shell it has no bell', () => {
    render(<PageHead title="Create SPK" crumb="Surat Perintah Kerja / New" />);
    expect(screen.getByText('Surat Perintah Kerja / New')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Notifications/ })).toBeNull();
  });

  it('DEC-94 the user circle sits at the foot of the rail and the logo opens the dashboard', () => {
    render(
      <AppShell
        items={items}
        activeKey="spk"
        user={{ name: 'Planner Sari', role: 'Planner' }}
        collapsed
        onCollapsedChange={vi.fn()}
      >
        <p>Main</p>
      </AppShell>,
    );
    const rail = screen.getByRole('navigation', { name: 'Main menu' }).closest('aside');
    expect(rail?.contains(screen.getByRole('button', { name: 'Planner Sari, Planner' }))).toBe(
      true,
    );
    expect(screen.getByRole('link', { name: 'BMI Stooring System' }).getAttribute('href')).toBe(
      '/dashboard',
    );
  });

  it('DEC-94 the title, the actions and the bell share one header row inside the main sheet', () => {
    const onOpenNotifications = vi.fn();
    render(
      <AppShell
        items={items}
        activeKey="spk"
        user={{ name: 'Planner Sari', role: 'Planner' }}
        collapsed
        onCollapsedChange={vi.fn()}
        unreadNotifications={4}
        onOpenNotifications={onOpenNotifications}
      >
        <PageHead title="Settings" actions={<Button variant="primary">New</Button>} />
      </AppShell>,
    );
    const sheet = screen.getByRole('main');
    const heading = within(sheet).getByRole('heading', { level: 1, name: 'Settings' });
    const row = heading.closest('.head');
    const bell = within(sheet).getByRole('button', { name: 'Notifications, 4 unread' });
    expect(row?.contains(bell)).toBe(true);
    expect(row?.contains(within(sheet).getByRole('button', { name: 'New' }))).toBe(true);
    fireEvent.click(bell);
    expect(onOpenNotifications).toHaveBeenCalledOnce();
  });
});

describe('NAV-6 Settings home', () => {
  it('NAV-6 the Settings home groups its items in cards that open their page', () => {
    render(<SettingsHome />);
    expect(screen.getByRole('heading', { name: 'Surat Perintah Kerja' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fleet and maintenance' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Alerts and system' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /SPK presets/ }).getAttribute('href')).toBe(
      '/settings/spk-presets',
    );
    expect(screen.queryByRole('link', { name: /Users and roles/ })).toBeNull();
  });
});
