'use client';

import { useFormState } from 'react-dom';
import Link from 'next/link';
import { Building2, ExternalLink, Power, PowerOff } from 'lucide-react';
import { toggleClubActiveAction } from '@/actions/admin';
import { formatMoney } from '@/lib/money';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, Badge, Card, EmptyState, SubmitButton } from '@/components/ui';

export interface AdminClubRow {
  id: string;
  name: string;
  city: string;
  ownerName: string;
  ownerEmail: string;
  courtCount: number;
  bookingCount: number;
  confirmedRevenue: number;
  hasPaymentConfig: boolean;
  isActive: boolean;
}

export function ClubTable({ clubs }: { clubs: AdminClubRow[] }) {
  if (clubs.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Building2 className="h-6 w-6" aria-hidden />}
          title="No clubs on the platform"
          description="Clubs appear here as owners are onboarded."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Club</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Courts</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Confirmed revenue</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">SaaS access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {clubs.map((club) => (
              <tr key={club.id} className={club.isActive ? '' : 'bg-zinc-50/60'}>
                <td className="px-4 py-3">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="inline-flex items-center gap-1.5 font-medium text-zinc-900 hover:text-brand-700"
                  >
                    {club.name}
                    <ExternalLink className="h-3 w-3 text-zinc-400" aria-hidden />
                  </Link>
                  <p className="text-xs text-zinc-500">{club.city}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-zinc-900">{club.ownerName}</p>
                  <p className="text-xs text-zinc-500">{club.ownerEmail}</p>
                </td>
                <td className="px-4 py-3 tabular-nums">{club.courtCount}</td>
                <td className="px-4 py-3 tabular-nums">{club.bookingCount}</td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(club.confirmedRevenue)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={club.isActive ? 'emerald' : 'red'}>{club.isActive ? 'Active' : 'Suspended'}</Badge>
                    {!club.hasPaymentConfig && <Badge tone="amber">No QR</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ToggleForm clubId={club.id} isActive={club.isActive} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Suspending a club hides it from discovery and blocks new bookings, but leaves
 * existing bookings and their payment records intact — this is a billing lever,
 * not a delete.
 */
function ToggleForm({ clubId, isActive }: { clubId: string; isActive: boolean }) {
  const [state, formAction] = useFormState(toggleClubActiveAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton
        size="sm"
        variant={isActive ? 'secondary' : 'success'}
        pendingLabel={isActive ? 'Suspending…' : 'Activating…'}
      >
        {isActive ? (
          <>
            <PowerOff className="h-3.5 w-3.5" aria-hidden />
            Suspend
          </>
        ) : (
          <>
            <Power className="h-3.5 w-3.5" aria-hidden />
            Activate
          </>
        )}
      </SubmitButton>
    </form>
  );
}
