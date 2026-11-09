import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthApi, Outcome } from '../../lib/auth-api';
import {
  ChangePasswordForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  SignInForm,
} from './AuthScreens';

afterEach(cleanup);

const user = (mustChangePassword = false) => ({
  id: 1,
  name: 'Budi Santoso',
  email: 'budi.s@bmi.co.id',
  role: 'Planner' as const,
  mustChangePassword,
});

const ok = <T,>(data: T): Promise<Outcome<T>> => Promise.resolve({ ok: true, data });
const refused = (status: number, message: string) =>
  Promise.resolve({ ok: false as const, status, message });

function fakeApi(overrides: Partial<Record<keyof AuthApi, unknown>> = {}): AuthApi {
  return {
    signIn: vi.fn(() => ok({ user: user() })),
    me: vi.fn(() => ok({ user: user() })),
    changePassword: vi.fn(() => ok({ user: user() })),
    forgotPassword: vi.fn(() => ok({ ok: true as const })),
    resetPassword: vi.fn(() => ok({ ok: true as const })),
    signOut: vi.fn(() => ok({ ok: true as const })),
    ...overrides,
  } as AuthApi;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = async (name: string) => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name })));
};

describe('WebLogin', () => {
  it('REQ-IAM-001 signs in with email and password and opens the home page', async () => {
    const api = fakeApi();
    const navigate = vi.fn();
    render(<SignInForm api={api} navigate={navigate} />);
    expect(
      screen.getByText(/After 5 failed sign-ins the account locks for 15 minutes/),
    ).toBeTruthy();
    type('Email', 'budi.s@bmi.co.id');
    type('Password', 'truck2026');
    await submit('Sign in');
    expect(api.signIn).toHaveBeenCalledWith('budi.s@bmi.co.id', 'truck2026');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('REQ-IAM-009 a first sign-in opens ChangePassword', async () => {
    const navigate = vi.fn();
    render(
      <SignInForm
        api={fakeApi({ signIn: vi.fn(() => ok({ user: user(true) })) })}
        navigate={navigate}
      />,
    );
    type('Email', 'budi.s@bmi.co.id');
    type('Password', 'Temp12345678');
    await submit('Sign in');
    expect(navigate).toHaveBeenCalledWith('/change-password');
  });

  it('C-34 REQ-IAM-001 a refusal shows one sentence and keeps what was typed', async () => {
    const message = 'This account is locked after 5 failed sign-ins.';
    const navigate = vi.fn();
    render(
      <SignInForm
        api={fakeApi({ signIn: vi.fn(() => refused(423, message)) })}
        navigate={navigate}
      />,
    );
    type('Email', 'budi.s@bmi.co.id');
    type('Password', 'wrong');
    await submit('Sign in');
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('budi.s@bmi.co.id');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('REQ-IAM-001 asks for both fields before sending', async () => {
    const api = fakeApi();
    render(<SignInForm api={api} navigate={vi.fn()} />);
    await submit('Sign in');
    expect(screen.getByRole('alert').textContent).toBe('Enter your email and password.');
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it('DQ-02 links to Forgot password', () => {
    render(<SignInForm api={fakeApi()} navigate={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Forgot password?' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });
});

describe('ChangePassword', () => {
  it('REQ-IAM-009 NFR-05 at the first sign-in it asks only the new password twice and continues home', async () => {
    const api = fakeApi({ me: vi.fn(() => ok({ user: user(true) })) });
    const navigate = vi.fn();
    await act(async () => render(<ChangePasswordForm api={api} navigate={navigate} />));
    expect(screen.queryByLabelText('Current password')).toBeNull();
    expect(screen.getByText('At least 8 characters with letters and digits.')).toBeTruthy();
    type('New password', 'newtruck2026');
    type('Repeat new password', 'newtruck2026');
    await submit('Save and continue');
    expect(api.changePassword).toHaveBeenCalledWith({
      newPassword: 'newtruck2026',
      repeatPassword: 'newtruck2026',
    });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('NFR-05 refuses a weak or repeated-wrong password before sending', async () => {
    const api = fakeApi({ me: vi.fn(() => ok({ user: user(true) })) });
    await act(async () => render(<ChangePasswordForm api={api} navigate={vi.fn()} />));
    type('New password', 'short');
    type('Repeat new password', 'short');
    await submit('Save and continue');
    expect(screen.getByRole('alert').textContent).toBe(
      'At least 8 characters with letters and digits.',
    );
    type('New password', 'newtruck2026');
    type('Repeat new password', 'newtruck2027');
    await submit('Save and continue');
    expect(screen.getByRole('alert').textContent).toBe('The two passwords are not the same.');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('NFR-05 from the user menu it also asks the current password', async () => {
    const api = fakeApi();
    await act(async () => render(<ChangePasswordForm api={api} navigate={vi.fn()} />));
    type('Current password', 'truck2026');
    type('New password', 'newtruck2026');
    type('Repeat new password', 'newtruck2026');
    await submit('Save and continue');
    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: 'truck2026',
      newPassword: 'newtruck2026',
      repeatPassword: 'newtruck2026',
    });
  });

  it('NFR-05 without a session it goes back to sign in', async () => {
    const navigate = vi.fn();
    await act(async () =>
      render(
        <ChangePasswordForm
          api={fakeApi({ me: vi.fn(() => refused(401, 'Your session ended. Sign in again.')) })}
          navigate={navigate}
        />,
      ),
    );
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

describe('ForgotPassword', () => {
  it('DEC-102 DEC-114 sends one reset link and says so the same way for every address', async () => {
    const api = fakeApi();
    render(<ForgotPasswordForm api={api} />);
    expect(
      screen.getByText('We send one reset link to this address. It expires after 60 minutes.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe(
      '/login',
    );
    type('Email', 'budi.s@bmi.co.id');
    await submit('Send reset link');
    expect(api.forgotPassword).toHaveBeenCalledWith('budi.s@bmi.co.id');
    expect(screen.getByRole('status').textContent).toBe(
      'If an account uses this address, a reset link is on its way. Check your email.',
    );
  });
});

describe('ResetPassword', () => {
  it('DEC-114 saves the new password from the link and goes to sign in', async () => {
    const api = fakeApi();
    const navigate = vi.fn();
    render(<ResetPasswordForm api={api} navigate={navigate} token={'t'.repeat(43)} />);
    type('New password', 'fresh2026x');
    type('Repeat new password', 'fresh2026x');
    await submit('Save new password');
    expect(api.resetPassword).toHaveBeenCalledWith({
      token: 't'.repeat(43),
      newPassword: 'fresh2026x',
      repeatPassword: 'fresh2026x',
    });
    expect(navigate).toHaveBeenCalledWith('/login?reset=done');
  });

  it('DEC-114 a used or expired link shows one sentence and a way to ask for a new one', async () => {
    const message = 'This reset link is no longer valid. Ask for a new one.';
    render(
      <ResetPasswordForm
        api={fakeApi({ resetPassword: vi.fn(() => refused(400, message)) })}
        navigate={vi.fn()}
        token={'t'.repeat(43)}
      />,
    );
    type('New password', 'fresh2026x');
    type('Repeat new password', 'fresh2026x');
    await submit('Save new password');
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.getByRole('link', { name: 'Ask for a new link' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });

  it('DEC-114 a link without a token says it is not valid', () => {
    render(<ResetPasswordForm api={fakeApi()} navigate={vi.fn()} token="" />);
    expect(screen.getByRole('alert').textContent).toBe(
      'This reset link is no longer valid. Ask for a new one.',
    );
  });
});
