'use client';

import { PASSWORD_RULE, PasswordSchema } from '@bmi/shared';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { homeAfterSignIn, type AuthApi } from '../../lib/auth-api';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';

const RESET_LINK_INVALID = 'This reset link is no longer valid. Ask for a new one.';
const PASSWORDS_DIFFER = 'The two passwords are not the same.';

/** WebLogin, ChangePassword, ForgotPassword and ResetPassword share one screen: brand left, form right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-stage">
      <div className="auth-screen">
        <div className="auth-brand">
          <span className="auth-logo">
            <img src="/bmi-logo.png" alt="BMI" width={150} height={150} />
          </span>
          <h1>BMI Stooring System</h1>
          <p className="muted">No maintenance without an approved Surat Perintah Kerja.</p>
        </div>
        <section className="auth-form">{children}</section>
      </div>
    </main>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Note({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="note">
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

/** C-34: the button is disabled while the request runs; a refusal is one sentence. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<string | null>) => async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const refusal = await work();
    setError(refusal);
    setBusy(false);
  };
  return { busy, error, run };
}

function Refusal({ message }: { message: string | null }) {
  return message ? (
    <p className="refusal" role="alert">
      {message}
    </p>
  ) : null;
}

function checkNewPassword(newPassword: string, repeatPassword: string): string | null {
  if (!PasswordSchema.safeParse(newPassword).success) return PASSWORD_RULE;
  if (newPassword !== repeatPassword) return PASSWORDS_DIFFER;
  return null;
}

export function SignInForm({
  api,
  navigate,
  notice,
}: {
  api: AuthApi;
  navigate: (path: string) => void;
  notice?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit();

  const onSubmit = run(async () => {
    if (!email.trim() || !password) return 'Enter your email and password.';
    const outcome = await api.signIn(email.trim(), password);
    if (!outcome.ok) return outcome.message;
    navigate(homeAfterSignIn(outcome.data.user));
    return null;
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      {notice && <Note icon="approvals">{notice}</Note>}
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <Note icon="lock">
        After 5 failed sign-ins the account locks for 15 minutes; an Access Manager can unlock it.
      </Note>
      <Refusal message={error} />
      <div className="bar">
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
          Sign in
        </Button>
      </div>
      <p className="small auth-link">
        <a href="/forgot-password">Forgot password?</a>
      </p>
    </form>
  );
}

export function ChangePasswordForm({
  api,
  navigate,
}: {
  api: AuthApi;
  navigate: (path: string) => void;
}) {
  const [firstSignIn, setFirstSignIn] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    let live = true;
    void api.me().then((outcome) => {
      if (!live) return;
      if (!outcome.ok) navigate('/login');
      else setFirstSignIn(outcome.data.user.mustChangePassword);
    });
    return () => {
      live = false;
    };
  }, [api, navigate]);

  const onSubmit = run(async () => {
    const problem = checkNewPassword(newPassword, repeatPassword);
    if (problem) return problem;
    const outcome = await api.changePassword(
      firstSignIn
        ? { newPassword, repeatPassword }
        : { currentPassword, newPassword, repeatPassword },
    );
    if (!outcome.ok) return outcome.message;
    navigate(homeAfterSignIn(outcome.data.user));
    return null;
  });

  if (firstSignIn === null) return null;
  return (
    <form onSubmit={onSubmit} noValidate>
      {!firstSignIn && (
        <Field
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
      )}
      <Field
        label="New password"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <Field
        label="Repeat new password"
        type="password"
        value={repeatPassword}
        onChange={setRepeatPassword}
        autoComplete="new-password"
      />
      <p className="small muted">{PASSWORD_RULE}</p>
      <Refusal message={error} />
      <div className="bar">
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
          Save and continue
        </Button>
      </div>
    </form>
  );
}

export function ForgotPasswordForm({ api }: { api: AuthApi }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();

  const onSubmit = run(async () => {
    if (!email.trim()) return 'Enter your email address.';
    const outcome = await api.forgotPassword(email.trim());
    if (!outcome.ok) return outcome.message;
    setSent(true);
    return null;
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <h3 className="auth-title">Forgot password</h3>
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" />
      <Note icon="clock">We send one reset link to this address. It expires after 60 minutes.</Note>
      {sent && (
        <p className="auth-sent" role="status">
          If an account uses this address, a reset link is on its way. Check your email.
        </p>
      )}
      <Refusal message={error} />
      <div className="bar">
        <a className="btn btn-secondary" href="/login">
          Back to sign in
        </a>
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
          Send reset link
        </Button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({
  api,
  navigate,
  token,
}: {
  api: AuthApi;
  navigate: (path: string) => void;
  token: string;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const { busy, error, run } = useSubmit();
  const shown = token ? error : RESET_LINK_INVALID;

  const onSubmit = run(async () => {
    const problem = checkNewPassword(newPassword, repeatPassword);
    if (problem) return problem;
    const outcome = await api.resetPassword({ token, newPassword, repeatPassword });
    if (!outcome.ok) return outcome.message;
    navigate('/login?reset=done');
    return null;
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <h3 className="auth-title">Choose a new password</h3>
      <Field
        label="New password"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <Field
        label="Repeat new password"
        type="password"
        value={repeatPassword}
        onChange={setRepeatPassword}
        autoComplete="new-password"
      />
      <p className="small muted">{PASSWORD_RULE}</p>
      <Refusal message={shown} />
      {shown === RESET_LINK_INVALID && (
        <p className="small auth-link">
          <a href="/forgot-password">Ask for a new link</a>
        </p>
      )}
      <div className="bar">
        <Button type="submit" variant="primary" disabled={busy || !token} aria-busy={busy}>
          Save new password
        </Button>
      </div>
    </form>
  );
}
