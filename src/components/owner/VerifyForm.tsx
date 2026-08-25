'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Check, X } from 'lucide-react';
import { verifyBookingAction } from '@/actions/owner';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, SubmitButton, Textarea } from '@/components/ui';

/**
 * Approve is one click. Reject deliberately is not: the reason is what the
 * player sees on their dashboard, so the form makes them type it before the
 * destructive action becomes available.
 */
export function VerifyForm({ bookingId }: { bookingId: string }) {
  const [state, formAction] = useFormState(verifyBookingAction, IDLE_ACTION_STATE);
  const [rejecting, setRejecting] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />

      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      {rejecting && (
        <div className="space-y-1.5">
          <Textarea
            name="rejectionReason"
            rows={2}
            required
            autoFocus
            maxLength={280}
            placeholder="e.g. Screenshot shows ₱300 but the booking is ₱600."
          />
          {state.fieldErrors?.rejectionReason?.length ? (
            <p className="text-xs font-medium text-red-600">{state.fieldErrors.rejectionReason[0]}</p>
          ) : (
            <p className="text-xs text-zinc-500">The player sees this reason. Rejecting frees the slot.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <SubmitButton name="decision" value="REJECT" variant="danger" pendingLabel="Rejecting…">
              <X className="h-4 w-4" aria-hidden />
              Confirm rejection
            </SubmitButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <SubmitButton name="decision" value="APPROVE" variant="success" pendingLabel="Approving…">
              <Check className="h-4 w-4" aria-hidden />
              Approve
            </SubmitButton>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50"
            >
              <X className="h-4 w-4" aria-hidden />
              Reject
            </button>
          </>
        )}
      </div>
    </form>
  );
}
