import type { ReactNode } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { requireRole } from '@/lib/session';
import { NavLink } from '@/components/layout/NavLink';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole(['SUPER_ADMIN'], '/admin/clubs');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900">
          <ShieldCheck className="h-6 w-6 text-brand-600" aria-hidden />
          Platform admin
        </h1>
        <nav className="flex gap-1">
          <NavLink href="/admin/clubs" icon={<Building2 className="h-4 w-4" aria-hidden />}>
            Clubs
          </NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
