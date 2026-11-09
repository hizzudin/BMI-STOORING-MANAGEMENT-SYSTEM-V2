import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KitPage from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('development kit gallery', () => {
  it('is not served in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => KitPage()).toThrow('NEXT_NOT_FOUND');
  });

  it('C-02 shows the shell with the Settings home and toggles the rail', () => {
    render(<KitPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    click('Expand menu');
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toBeTruthy();
  });

  it('C-12 C-16 C-32 opens and closes each confirmation', () => {
    render(<KitPage />);
    click('Leave page');
    expect(screen.queryByRole('dialog')).toBeNull();
    click('Type something');
    click('Leave page');
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeTruthy();
    click('Stay');
    click('Leave page');
    click('Leave');
    expect(screen.queryByRole('dialog')).toBeNull();

    click('Discard changes');
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeTruthy();
    click('Keep editing');
    click('Discard changes');
    click('Discard');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0] as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'Deactivate this record?' })).toBeTruthy();
    click('Cancel');
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[1] as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
