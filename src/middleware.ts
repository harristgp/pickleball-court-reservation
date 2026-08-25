import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// The Edge-safe config only. Importing auth.ts here would pull Prisma and
// bcrypt into the Edge bundle and fail to build.
export default NextAuth(authConfig).auth;

export const config = {
  // Guard everything except static assets, uploads, and the auth API itself.
  matcher: ['/((?!api/auth|_next/static|_next/image|uploads|favicon\.ico|.*\.png$|.*\.svg$).*)'],
};
