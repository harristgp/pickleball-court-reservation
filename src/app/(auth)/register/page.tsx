import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { RegisterForm } from '@/components/layout/AuthForm';
import { getCurrentUser } from '@/lib/session';
import { homePathForRole } from '@/auth.config';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-500">Book courts as a player, or list your club as an owner.</p>
      </div>

      <Card className="p-6">
        <RegisterForm />
      </Card>
    </div>
  );
}
