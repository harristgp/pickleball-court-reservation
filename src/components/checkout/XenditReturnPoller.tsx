'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { Alert, Button } from '@/components/ui';

type PollState =
  | { kind: 'checking' }
  | { kind: 'paid'; channel: string | null }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string };

interface StatusResponse {
  bookingStatus: 'PENDING_PAYMENT' | 'PENDING_VERIFICATION' | 'CONFIRMED' | 'REJECTED';
  amount: number;
  currency: string;
  payment: { status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'; channel: string | null } | null;
  error?: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 20;

/**
 * Return-URL landing state. The redirect back from Xendit proves nothing, so
 * this polls our own backend (which the webhook updates) and renders the
 * local booking status: success, still-pending, or failed.
 */
export function XenditReturnPoller({ groupId }: { groupId: string }) {
  const [state, setState] = useState<PollState>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll(): Promise<void> {
      attempts += 1;
      try {
        const response = await fetch(`/api/payments/xendit/sessions?groupId=${encodeURIComponent(groupId)}`, {
          cache: 'no-store',
        });
        const data = (await response.json()) as StatusResponse;
        if (cancelled) return;

        if (!response.ok) {
          setState({ kind: 'failed', message: data.error ?? 'Could not check the payment status.' });
          return;
        }

        if (data.bookingStatus === 'CONFIRMED' || data.payment?.status === 'PAID') {
          setState({ kind: 'paid', channel: data.payment?.channel ?? null });
          return;
        }
        if (data.bookingStatus === 'REJECTED') {
          setState({
            kind: 'failed',
            message: 'This booking is no longer active. The slots were released — please book again.',
          });
          return;
        }
        if (data.payment && ['FAILED', 'EXPIRED', 'CANCELLED'].includes(data.payment.status)) {
          setState({
            kind: 'failed',
            message: 'The online payment did not complete. No charge was confirmed — try again from checkout.',
          });
          return;
        }
        if (attempts >= POLL_ATTEMPTS) {
          // Webhook may still be in flight (or the tab was closed mid-pay and
          // reopened here): report pending rather than failure.
          setState({ kind: 'pending' });
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        if (attempts >= POLL_ATTEMPTS) {
          setState({ kind: 'failed', message: 'Could not reach the server. Check your dashboard for the latest status.' });
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (state.kind === 'checking') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" aria-hidden />
        <p className="font-semibold text-zinc-900">Confirming your payment…</p>
        <p className="max-w-sm text-sm text-zinc-500">
          We are waiting for the payment provider&apos;s confirmation. Do not close this page.
        </p>
      </div>
    );
  }

  if (state.kind === 'paid') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
        <p className="text-lg font-bold text-zinc-900">Payment confirmed</p>
        <p className="max-w-sm text-sm text-zinc-500">
          Your courts are booked — see you on the court.
          {state.channel && ` (${state.channel})`}
        </p>
        <Link href="/dashboard">
          <Button size="lg">Go to my bookings</Button>
        </Link>
      </div>
    );
  }

  if (state.kind === 'pending') {
    return (
      <div className="space-y-4 py-6">
        <Alert tone="neutral">
          <span className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Payment pending. The provider has not confirmed yet — this usually resolves within a few minutes,
              even if you close this page. Check your dashboard for the final status.
            </span>
          </span>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button>Go to my bookings</Button>
          </Link>
          <Link href={`/checkout/${groupId}`}>
            <Button variant="secondary">Back to checkout</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-6">
      <Alert tone="error">
        <span className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </span>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Link href={`/checkout/${groupId}`}>
          <Button>Try again</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="secondary">Go to my bookings</Button>
        </Link>
      </div>
    </div>
  );
}
