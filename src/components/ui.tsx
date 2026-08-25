import type { ReactNode } from 'react';
import type { BookingStatus, CourtSurface, SkillLevel } from '@/types';

/** Tiny presentational primitives shared across the two dashboards. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-slate-200 bg-white shadow-card',
        className ?? 'p-5 sm:p-6',
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-400 shadow-sm">
        {icon}
      </span>
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'brand' | 'amber';
}) {
  const tones: Record<string, string> = {
    neutral: 'text-slate-900',
    brand: 'text-brand-700',
    amber: 'text-amber-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 font-display text-2xl font-semibold tabular-nums', tones[tone])}>
        {value}
      </p>
    </div>
  );
}

const SKILL_STYLES: Record<SkillLevel, string> = {
  BEGINNER: 'bg-sky-50 text-sky-700 ring-sky-200',
  INTERMEDIATE: 'bg-brand-50 text-brand-700 ring-brand-200',
  ADVANCED: 'bg-violet-50 text-violet-700 ring-violet-200',
  PRO: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export const SKILL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner (1.0 - 2.5)',
  INTERMEDIATE: 'Intermediate (3.0 - 3.5)',
  ADVANCED: 'Advanced (4.0 - 4.5)',
  PRO: 'Pro (5.0+)',
};

export const SKILL_SHORT: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  PRO: 'Pro',
};

export function SkillBadge({ level }: { level: SkillLevel }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        SKILL_STYLES[level],
      )}
    >
      {SKILL_SHORT[level]}
    </span>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const confirmed = status === 'CONFIRMED';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        confirmed
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-500 ring-slate-200',
      )}
    >
      {confirmed ? 'Confirmed' : 'Cancelled'}
    </span>
  );
}

export function SurfaceBadge({ surface }: { surface: CourtSurface }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        surface === 'INDOOR'
          ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
          : 'bg-teal-50 text-teal-700 ring-teal-200',
      )}
    >
      {surface === 'INDOOR' ? 'Indoor' : 'Outdoor'}
    </span>
  );
}
