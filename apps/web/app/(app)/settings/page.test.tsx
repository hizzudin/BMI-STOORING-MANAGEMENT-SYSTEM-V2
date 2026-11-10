import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import SettingsPage from './page';

afterEach(cleanup);

it('NAV-6 the Settings route shows the Settings home with its three groups', () => {
  render(<SettingsPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
    'Surat Perintah Kerja',
    'Fleet and maintenance',
    'Alerts and system',
  ]);
});
