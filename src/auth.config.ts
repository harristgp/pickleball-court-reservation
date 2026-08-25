import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@prisma/client';

/**
 * Edge-safe half of the auth setup.
 *
 * middleware.ts runs on the Edge runtime, where Prisma and bcrypt cannot load.
 * This file therefore holds only pure callbacks and route rules; the Credentials
 * provider (which needs both) lives in auth.ts and is merged in there.
 */

/** Route prefixes and the role each one demands. Order matters: first match wins. */
const ROLE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/admin', roles: ['SUPER_ADMIN'] },
  { prefix: '/owner', roles: ['OWNER', 'SUPER_ADMIN'] },
  { prefix: '/dashboard', roles: ['PLAYER', 'OWNER', 'SUPER_ADMIN'] },
  { prefix: '/checkout', roles: ['PLAYER', 'OWNER', 'SUPER_ADMIN'] },
];

export function ruleForPath(pathname: string) {
  return ROLE_RULES.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
}

/** Where a signed-in user belongs after login when no callbackUrl was given. */
export function homePathForRole(role: Role): string {
  if (role === 'SUPER_ADMIN') return '/admin/owners';
  if (role === 'OWNER') return '/owner';
  return '/dashboard';
}

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    // Runs in middleware for every guarded request.
    authorized({ auth, request }) {
      const rule = ruleForPath(request.nextUrl.pathname);
      if (!rule) return true;

      const role = auth?.user?.role;
      if (!role) return false; // NextAuth redirects to pages.signIn with callbackUrl
      if (rule.roles.includes(role)) return true;

      // Signed in but wrong role: bounce to their own landing page rather than
      // to the login screen, which would look like a broken session.
      return Response.redirect(new URL(homePathForRole(role), request.nextUrl));
    },

    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.name = user.name ?? null;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
