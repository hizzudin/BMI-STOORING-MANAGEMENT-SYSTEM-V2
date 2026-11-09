'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { authApi } from '../../lib/auth-api';
import {
  AuthLayout,
  ChangePasswordForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  SignInForm,
} from './AuthScreens';

function useAuthApi() {
  return useMemo(() => authApi(), []);
}

function useNavigate() {
  const router = useRouter();
  return useMemo(() => (path: string) => router.replace(path), [router]);
}

export function SignInPage({ resetDone }: { resetDone: boolean }) {
  return (
    <AuthLayout>
      <SignInForm
        api={useAuthApi()}
        navigate={useNavigate()}
        notice={resetDone ? 'Your password is changed. Sign in with the new one.' : undefined}
      />
    </AuthLayout>
  );
}

export function ChangePasswordPage() {
  return (
    <AuthLayout>
      <ChangePasswordForm api={useAuthApi()} navigate={useNavigate()} />
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordForm api={useAuthApi()} />
    </AuthLayout>
  );
}

export function ResetPasswordPage({ token }: { token: string }) {
  return (
    <AuthLayout>
      <ResetPasswordForm api={useAuthApi()} navigate={useNavigate()} token={token} />
    </AuthLayout>
  );
}
