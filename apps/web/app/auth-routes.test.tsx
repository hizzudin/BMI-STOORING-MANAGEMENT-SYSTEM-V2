import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordRoute from './change-password/page';
import ForgotPasswordRoute from './forgot-password/page';
import LoginRoute from './login/page';
import ResetPasswordRoute from './reset-password/page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              id: 1,
              name: 'B',
              email: 'b@bmi.co.id',
              role: 'Planner',
              mustChangePassword: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('sign-in routes', () => {
  it('REQ-IAM-001 /login shows the sign-in form, with a note after a reset', async () => {
    render(await LoginRoute({ searchParams: Promise.resolve({ reset: 'done' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'BMI Stooring System' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('Your password is changed. Sign in with the new one.')).toBeTruthy();
  });

  it('REQ-IAM-001 /login without a reset shows no note', async () => {
    render(await LoginRoute({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(/Your password is changed/)).toBeNull();
  });

  it('REQ-IAM-009 /change-password reads the session first', async () => {
    await act(async () => render(<ChangePasswordRoute />));
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeTruthy();
  });

  it('DEC-102 /forgot-password and /reset-password show their forms', async () => {
    render(<ForgotPasswordRoute />);
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeTruthy();
    cleanup();
    render(await ResetPasswordRoute({ searchParams: Promise.resolve({ token: 't'.repeat(43) }) }));
    expect(screen.getByRole('button', { name: 'Save new password' })).toBeTruthy();
    cleanup();
    render(await ResetPasswordRoute({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('alert').textContent).toBe(
      'This reset link is no longer valid. Ask for a new one.',
    );
  });
});
