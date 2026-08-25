'use client';

import { useFormState } from 'react-dom';
import { ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { toggleOwnerActiveAction } from '@/actions/admin';
import { Alert, EmptyState, Spinner } from '@/components/ui';
import { IDLE_ACTION_STATE } from '@/lib/types';

interface OwnerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  courtCount: number;
  activeCourtCount: number;
  paymentMethodCount: number;
  createdAt: string;
}

export function OwnerTable({ owners }: { owners: OwnerRow[] }) {
  if (owners.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" aria-hidden />}
        title="No owners yet"
        description="Owner accounts will appear here once they register."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card">
      <table className="min-w-full divide-y divide-zinc-200">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Owner
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Courts
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Payment Methods
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Toggle
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {owners.map((owner) => (
            <OwnerRow key={owner.id} owner={owner} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OwnerRow({ owner }: { owner: OwnerRow }) {
  const [state, formAction] = useFormState(toggleOwnerActiveAction, IDLE_ACTION_STATE);

  return (
    <tr className="group">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">{owner.name}</p>
        <p className="text-xs text-zinc-500">{owner.email}</p>
        {owner.phone && <p className="text-xs text-zinc-400">{owner.phone}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700">
        {owner.activeCourtCount}/{owner.courtCount}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700">{owner.paymentMethodCount}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            owner.isActive
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
              : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
          }`}
        >
          {owner.isActive ? 'Active' : 'Suspended'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <form action={formAction}>
          <input type="hidden" name="ownerId" value={owner.id} />
          <input type="hidden" name="isActive" value={owner.isActive ? 'false' : 'true'} />
          <button
            type="submit"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            {owner.isActive ? (
              <>
                <ToggleRight className="h-4 w-4 text-emerald-600" aria-hidden />
                Suspend
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 text-red-600" aria-hidden />
                Activate
              </>
            )}
          </button>
        </form>
        {state.message && state.ok && (
          <p className="mt-1 text-xs text-emerald-600">{state.message}</p>
        )}
      </td>
    </tr>
  );
}
