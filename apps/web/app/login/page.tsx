import { SignInPage } from '../../components/auth/AuthPages';

// WebLogin (REQ-IAM-001). ?reset=done arrives after a password reset (DEC-114).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  return <SignInPage resetDone={reset === 'done'} />;
}
