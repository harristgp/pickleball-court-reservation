'use client';

import { useMemo, useState } from 'react';
import { Inbox, RotateCcw, Search } from 'lucide-react';
import { COURTS, courtById } from '@/lib/courts';
import { formatDateLong, formatDateShort, formatSlotRange, isBefore } from '@/lib/dates';
import { isPastBooking, sortByStart } from '@/lib/slots';
import { EmptyState, SkillBadge, StatTile, StatusBadge, cx } from './ui';
import type { Booking } from '@/types';

interface AdminTableProps {
  bookings: Booking[];
  today: string;
  now: Date;
  onCancel: (id: string) => void;
  onReset: () => void;
}

type ScopeFilter = 'UPCOMING' | 'TODAY' | 'ALL';

const SCOPES: Array<{ id: ScopeFilter; label: string }> = [
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'TODAY', label: 'Today' },
  { id: 'ALL', label: 'All' },
];

/**
 * Admin dashboard: every reservation across all four courts as a list, with
 * scope, court, and free-text filters. Cancelling here releases the slot back
 * to the booking grid immediately.
 */
export function AdminTable({ bookings, today, now, onCancel, onReset }: AdminTableProps) {
  const [scope, setScope] = useState<ScopeFilter>('UPCOMING');
  const [courtFilter, setCourtFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const stats = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === 'CONFIRMED');
    const upcoming = confirmed.filter((booking) => !isPastBooking(booking, now));
    const revenue = confirmed
      .filter((booking) => !isBefore(booking.date, today))
      .reduce((total, booking) => total + courtById(booking.courtId).hourlyRate, 0);

    return {
      total: bookings.length,
      upcoming: upcoming.length,
      todayCount: confirmed.filter((booking) => booking.date === today).length,
      revenue,
    };
  }, [bookings, now, today]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sortByStart(
      bookings.filter((booking) => {
        if (courtFilter !== 'ALL' && booking.courtId !== courtFilter) return false;

        if (scope === 'TODAY' && booking.date !== today) return false;
        if (scope === 'UPCOMING' && (isBefore(booking.date, today) || booking.status !== 'CONFIRMED')) {
          return false;
        }

        if (needle.length > 0) {
          const haystack = `${booking.name} ${booking.email} ${booking.phone}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }

        return true;
      }),
    );
  }, [bookings, courtFilter, query, scope, today]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Upcoming" value={stats.upcoming} tone="brand" />
        <StatTile label="Today" value={stats.todayCount} />
        <StatTile label="All records" value={stats.total} />
        <StatTile label="Booked revenue" value={`$${stats.revenue}`} tone="amber" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1 ring-1 ring-inset ring-slate-200">
            {SCOPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                aria-pressed={scope === item.id}
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  scope === item.id
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="court-filter">
            Filter by court
          </label>
          <select
            id="court-filter"
            value={courtFilter}
            onChange={(event) => setCourtFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="ALL">All courts</option>
            {COURTS.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <label className="sr-only" htmlFor="admin-search">
              Search reservations
            </label>
            <input
              id="admin-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, or phone"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <button
            type="button"
            onClick={onReset}
            title="Restore the sample reservations"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Reset demo</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" aria-hidden />}
          title="No reservations match"
          description="Widen the scope or clear the search to see more records."
        />
      ) : (
        <>
          {/* Cards on small screens, a real table from md up. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((booking) => {
              const court = courtById(booking.courtId);
              return (
                <li key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{booking.name}</p>
                      <p className="truncate text-xs text-slate-500">{booking.email}</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <dt className="text-slate-400">Date</dt>
                      <dd>{formatDateShort(booking.date)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Time</dt>
                      <dd>{formatSlotRange(booking.startHour)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Court</dt>
                      <dd>{court.name}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Total</dt>
                      <dd className="tabular-nums">${court.hourlyRate}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <SkillBadge level={booking.skillLevel} />
                    {booking.status === 'CONFIRMED' ? (
                      <button
                        type="button"
                        onClick={() => onCancel(booking.id)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <Th>Player</Th>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Court</Th>
                  <Th>Skill</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => {
                  const court = courtById(booking.courtId);
                  const cancelled = booking.status === 'CANCELLED';

                  return (
                    <tr
                      key={booking.id}
                      className={cx(
                        'border-b border-slate-100 last:border-b-0',
                        cancelled ? 'bg-slate-50/60 text-slate-400' : 'hover:bg-slate-50',
                      )}
                    >
                      <Td>
                        <span
                          className={cx(
                            'block font-medium',
                            cancelled ? 'text-slate-500' : 'text-slate-900',
                          )}
                        >
                          {booking.name}
                        </span>
                        <span className="block text-xs text-slate-500">{booking.email}</span>
                        <span className="block text-xs text-slate-400">{booking.phone}</span>
                      </Td>
                      <Td>
                        <span className="whitespace-nowrap">{formatDateLong(booking.date)}</span>
                      </Td>
                      <Td>
                        <span className="whitespace-nowrap tabular-nums">
                          {formatSlotRange(booking.startHour)}
                        </span>
                      </Td>
                      <Td>{court.name}</Td>
                      <Td>
                        <SkillBadge level={booking.skillLevel} />
                      </Td>
                      <Td>
                        <StatusBadge status={booking.status} />
                      </Td>
                      <Td className="text-right tabular-nums">${court.hourlyRate}</Td>
                      <Td className="text-right">
                        {cancelled ? (
                          <span className="text-xs text-slate-400">Released</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCancel(booking.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cx(
        'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cx('px-4 py-3 align-top', className)}>{children}</td>;
}
