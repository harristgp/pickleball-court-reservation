import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { LoginForm } from '@/components/layout/AuthForm';
import { getCurrentUser } from '@/lib/session';
import { homePathForRole } from '@/auth.config';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-500">Sign in to book a court or manage your club.</p>
      </div>

      <Card className="p-6">
        <LoginForm callbackUrl={searchParams.callbackUrl} />
      </Card>

      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-xs text-zinc-600">
        <p className="font-semibold text-zinc-700">Demo accounts (password: password123)</p>
        <ul className="mt-2 space-y-1 font-mono">
          <li>admin@dinkcourt.test — super admin</li>
          <li>owner@smashcity.test — club owner</li>
          <li>player@dinkcourt.test — player</li>
        </ul>
      </div>
    </div>
  );
}
