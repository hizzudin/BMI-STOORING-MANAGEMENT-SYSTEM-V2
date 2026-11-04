import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import HomePage from './page';

afterEach(cleanup);

it('renders the product name in the main region', () => {
  render(<HomePage />);
  expect(screen.getByRole('main').textContent).toBe('BMI Stooring System');
});
