import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import HomePage from './page';

afterEach(cleanup);

it('C-01 the Dashboard item opens the home page', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
});
