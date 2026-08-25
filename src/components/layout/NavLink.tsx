'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const STYLES = {
  pill: {
    base: 'rounded-lg px-3 py-2',
    active: 'bg-brand-50 text-brand-700',
    idle: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  },
  tab: {
    base: '-mb-px rounded-t-lg border-b-2 px-3 py-2.5',
    active: 'border-brand-500 text-brand-700',
    idle: 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800',
  },
} as const;

export function NavLink({
  href,
  icon,
  children,
  exact = false,
  variant = 'pill',
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Section roots such as /owner must not stay lit on /owner/courts. */
  exact?: boolean;
  variant?: keyof typeof STYLES;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const style = STYLES[variant];

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors',
        style.base,
        active ? style.active : style.idle,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
