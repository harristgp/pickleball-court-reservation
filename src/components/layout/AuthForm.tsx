'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { loginAction, registerAction } from '@/actions/auth';
import { Alert, Field, Input, Select, SubmitButton } from '@/components/ui';
import { IDLE_ACTION_STATE } from '@/lib/types';

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useFormState(loginAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>

      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        <LogIn className="h-4 w-4" aria-hidden />
        Sign in
      </SubmitButton>

      <p className="text-center text-sm text-zinc-500">
        No account yet?{' '}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" required autoComplete="name" placeholder="Alex Reyes" />
      </Field>

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </Field>

      <Field label="Mobile number" htmlFor="phone" hint="Optional. Owners use it to reach you about a booking." error={state.fieldErrors?.phone}>
        <Input id="phone" name="phone" autoComplete="tel" placeholder="+63 917 000 0000" />
      </Field>

      <Field label="I am a" htmlFor="role" error={state.fieldErrors?.role}>
        <Select id="role" name="role" defaultValue="PLAYER">
          <option value="PLAYER">Player looking for courts</option>
          <option value="OWNER">Court owner listing courts</option>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" hint="At least 8 characters." error={state.fieldErrors?.password}>
          <Input id="password" name="password" type="password" required autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword}>
          <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
        </Field>
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Creating account…">
        <UserPlus className="h-4 w-4" aria-hidden />
        Create account
      </SubmitButton>

      <p className="text-center text-sm text-zinc-500">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
