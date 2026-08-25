import Link from 'next/link';
import { CalendarCheck, LayoutDashboard, MapPin, Settings2, ShieldCheck, Trophy } from 'lucide-react';
import { getCurrentUser } from '@/lib/session';
import { logoutAction } from '@/actions/auth';
import { NavLink } from '@/components/layout/NavLink';

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-base font-bold tracking-tight text-zinc-900">
            Dink<span className="text-brand-600">Court</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          <NavLink href="/discover" icon={<MapPin className="h-4 w-4" />}>
            Discover
          </NavLink>

          {user && (
            <NavLink href="/dashboard" icon={<CalendarCheck className="h-4 w-4" />}>
              My bookings
            </NavLink>
          )}

          {user?.role === 'OWNER' && (
            <NavLink href="/owner" icon={<LayoutDashboard className="h-4 w-4" />}>
              Club
            </NavLink>
          )}

          {user?.role === 'SUPER_ADMIN' && (
            <>
              <NavLink href="/admin/clubs" icon={<ShieldCheck className="h-4 w-4" />}>
                Admin
              </NavLink>
              <NavLink href="/owner" icon={<Settings2 className="h-4 w-4" />}>
                Club tools
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-zinc-900">{user.name}</p>
                <p className="text-xs leading-tight text-zinc-500">{user.role.replace('_', ' ').toLowerCase()}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
