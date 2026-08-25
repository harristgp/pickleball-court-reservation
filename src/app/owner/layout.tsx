import type { ReactNode } from 'react';
import { BadgeCheck, LayoutDashboard, QrCode, Trophy } from 'lucide-react';
import { requireRole } from '@/lib/session';
import { NavLink } from '@/components/layout/NavLink';

const TABS = [
  { href: '/owner', label: 'Overview', icon: LayoutDashboard },
  { href: '/owner/verify', label: 'Approvals', icon: BadgeCheck },
  { href: '/owner/courts', label: 'Courts', icon: Trophy },
  { href: '/owner/settings', label: 'Payment settings', icon: QrCode },
];

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  await requireRole(['OWNER', 'SUPER_ADMIN'], '/owner');

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 pb-px">
        {TABS.map((tab) => (
          <NavLink key={tab.href} href={tab.href} exact={tab.href === '/owner'} variant="tab">
            <tab.icon className="h-4 w-4" aria-hidden />
            {tab.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
