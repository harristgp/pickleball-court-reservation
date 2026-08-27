import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Proxy runs on Node.js runtime by default (no Edge restriction).
// Importing auth.ts here would pull Prisma and bcrypt into the bundle.
const handler = NextAuth(authConfig).auth;

export default handler;

export const config = {
  // Guard everything except static assets, uploads, and the auth API itself.
  matcher: ['/((?!api/auth|_next/static|_next/image|uploads|favicon\.ico|.*\.png$|.*\.svg$).*)'],
};
