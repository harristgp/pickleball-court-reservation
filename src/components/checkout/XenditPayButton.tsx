'use client';

import { useState } from 'react';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { Alert, Button } from '@/components/ui';

/**
 * Starts a Xendit hosted checkout for the booking group.
 *
 * The browser never decides the amount or the outcome: POSTing only names the
 * group, the server builds the session from database data, and the payment is
 * confirmed later by the Xendit webhook — not by the return redirect.
 */
export function XenditPayButton({
  groupId,
  amount,
  recipientName,
  settlesToOwner,
}: {
  groupId: string;
  amount: number;
  recipientName: string;
  settlesToOwner: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'redirecting'>('idle');
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== 'idle';

  async function startPayment() {
    if (busy) return; // Duplicate-click protection.
    setPhase('working');
    setError(null);

    let data: { paymentLinkUrl?: string; error?: string };
    try {
      const response = await fetch('/api/payments/xendit/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });
      data = (await response.json()) as typeof data;
      if (!response.ok || !data.paymentLinkUrl) {
        throw new Error(data.error ?? 'Could not start the online payment. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the online payment. Please try again.');
      setPhase('idle');
      return;
    }

    // Hand off to Xendit's hosted checkout; the success page polls our own
    // backend afterwards instead of trusting this redirect.
    setPhase('redirecting');
    window.location.href = data.paymentLinkUrl;
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-brand-900">
          <CreditCard className="h-4 w-4" aria-hidden />
          Pay online
        </span>
        <span className="text-xl font-bold tabular-nums text-brand-900">{formatMoney(amount)}</span>
      </div>

      <Button size="lg" className="w-full" onClick={startPayment} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {phase === 'redirecting' ? 'Opening secure checkout…' : 'Preparing checkout…'}
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" aria-hidden />
            Pay {formatMoney(amount)} with GCash, Maya, card, or bank
          </>
        )}
      </Button>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-zinc-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        You will be redirected to Xendit&apos;s secure checkout and returned here afterwards.
        {settlesToOwner
          ? ` ${recipientName} receives this payment directly into their Xendit account.`
          : ` ${recipientName} receives this payment via the PCourt platform account.`}{' '}
        Your booking is confirmed once the payment provider notifies us — this can take a few seconds after you
        pay.
      </p>
    </div>
  );
}
