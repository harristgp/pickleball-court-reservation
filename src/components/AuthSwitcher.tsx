'use client';

import { ShieldCheck, User } from 'lucide-react';
import { cx } from './ui';
import type { Role, Session } from '@/types';

interface AuthSwitcherProps {
  session: Session;
  onChange: (role: Role) => void;
}

/**
 * Mock auth control. Flipping this swaps the whole dashboard between the
 * player booking flow and the admin reservation list.
 */
export function AuthSwitcher({ session, onChange }: AuthSwitcherProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold leading-tight text-slate-900">{session.name}</p>
        <p className="text-xs leading-tight text-slate-500">{session.email}</p>
      </div>

      <div
        role="group"
        aria-label="Switch role"
        className="flex rounded-full bg-slate-100 p-1 ring-1 ring-inset ring-slate-200"
      >
        <RoleTab
          active={session.role === 'USER'}
          label="Player"
          onClick={() => onChange('USER')}
          icon={<User className="h-3.5 w-3.5" aria-hidden />}
        />
        <RoleTab
          active={session.role === 'ADMIN'}
          label="Admin"
          onClick={() => onChange('ADMIN')}
          icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
        />
      </div>
    </div>
  );
}

function RoleTab({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-500 hover:text-slate-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
