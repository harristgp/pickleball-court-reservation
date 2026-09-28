'use client';

import { useFormState } from 'react-dom';
import { Landmark } from 'lucide-react';
import { saveXenditSubAccountAction } from '@/actions/owner';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, Field, Input, SubmitButton } from '@/components/ui';

/**
 * Links the owner's XenPlatform sub-account (Business ID from the Xendit
 * dashboard) so online payments settle into their own Xendit balance.
 * Clearing the field unlinks and restores master-account settlement.
 */
export function XenditPayoutForm({ currentSubAccountId }: { currentSubAccountId: string | null }) {
  const [state, formAction] = useFormState(saveXenditSubAccountAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <Field
        label="Xendit sub-account Business ID"
        htmlFor="subAccountId"
        hint="Found in your Xendit dashboard under xenPlatform → Sub-accounts. Leave empty to unlink."
        error={state.fieldErrors?.subAccountId}
      >
        <Input
          id="subAccountId"
          name="subAccountId"
          defaultValue={currentSubAccountId ?? ''}
          placeholder="e.g. 5f8d0c0603ffe06b7d4d9fcf"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">
          <Landmark className="h-4 w-4" aria-hidden />
          {currentSubAccountId ? 'Update payout account' : 'Link payout account'}
        </SubmitButton>
        <p className="text-xs text-zinc-500">
          {currentSubAccountId
            ? 'Linked — new payments settle into your Xendit balance.'
            : 'Not linked — payments settle to the platform account for now.'}
        </p>
      </div>
    </form>
  );
}
