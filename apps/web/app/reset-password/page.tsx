import { ResetPasswordPage } from '../../components/auth/AuthPages';

// ResetPassword, opened from the emailed link (DEC-102, DEC-114).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordPage token={token ?? ''} />;
}
