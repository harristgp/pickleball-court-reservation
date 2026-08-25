'use client';

import { useFormState } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { cancelBookingAction } from '@/actions/booking';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, SubmitButton } from '@/components/ui';

/** Releases the hold immediately instead of waiting out the 30-minute sweep. */
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, formAction] = useFormState(cancelBookingAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <SubmitButton variant="ghost" size="sm" pendingLabel="Releasing…">
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Cancel and free this slot
      </SubmitButton>
      <p className="text-xs text-zinc-500">Changed your mind? Release the slot so someone else can take it.</p>
    </form>
  );
}
