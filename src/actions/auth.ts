'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { homePathForRole } from '@/auth.config';
import { loginSchema, registerSchema } from '@/lib/validators';
import type { ActionState } from '@/lib/types';

/**
 * Only same-origin destinations may be redirected to, so a crafted callbackUrl
 * cannot turn the login form into an open redirect. The proxy hands back
 * an absolute URL, so both shapes have to be accepted — but an absolute one
 * only when its origin is this app's own.
 */
function safeCallback(raw: string | null): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  const appOrigin = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appOrigin) return undefined;

  try {
    const target = new URL(raw);
    if (target.origin !== new URL(appOrigin).origin) return undefined;
    return `${target.pathname}${target.search}`;
  } catch {
    return undefined;
  }
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const rawCallback = formData.get('callbackUrl');
  const callbackUrl = safeCallback(typeof rawCallback === 'string' ? rawCallback : null);

  try {
    await signIn('credentials', { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, message: 'Email or password is incorrect.' };
    }
    throw error;
  }

  if (callbackUrl) redirect(callbackUrl);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true },
  });
  redirect(user ? homePathForRole(user.role) : '/dashboard');
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, phone, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, fieldErrors: { email: ['That email is already registered.'] } };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  await signIn('credentials', { email, password, redirect: false });
  redirect(homePathForRole(role));
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
