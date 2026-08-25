'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Banknote, QrCode, ScanLine } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui';
import type { PaymentMethodSummary } from '@/lib/types';

export interface QrPanelProps {
  clubName: string;
  amount: number;
  paymentMethods: PaymentMethodSummary[];
  selectedMethodId?: string | null;
  onMethodChange?: (methodId: string) => void;
}

/**
 * Renders the club's payment targets. When the club has multiple methods
 * (GCash, Maya, bank, etc.), a tab picker lets the player choose which one
 * to pay to. The QR code is shown large enough to scan from another phone.
 */
export function QrPanel({
  clubName,
  amount,
  paymentMethods,
  selectedMethodId,
  onMethodChange,
}: QrPanelProps) {
  const [activeId, setActiveId] = useState(() => {
    if (selectedMethodId && paymentMethods.some((m) => m.id === selectedMethodId)) {
      return selectedMethodId;
    }
    return paymentMethods[0]?.id ?? '';
  });

  const active = paymentMethods.find((m) => m.id === activeId) ?? paymentMethods[0] ?? null;

  function select(id: string) {
    setActiveId(id);
    onMethodChange?.(id);
  }

  if (paymentMethods.length === 0) {
    return (
      <Alert tone="error">
        {clubName} has not published payment details yet. Contact the club before paying — your slot is held
        for 30 minutes.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-brand-900">
          <Banknote className="h-4 w-4" aria-hidden />
          Amount to send
        </span>
        <span className="text-xl font-bold tabular-nums text-brand-900">{formatMoney(amount)}</span>
      </div>

      {paymentMethods.length > 1 && (
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => select(method.id)}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                method.id === activeId
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {method.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-4">
          {paymentMethods.length === 1 && (
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Pay via {active.name}
            </p>
          )}

          <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5">
            {active.qrCodeUrl ? (
              <div className="relative h-56 w-56 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
                <Image
                  src={active.qrCodeUrl}
                  alt={`Payment QR code for ${active.name} — ${clubName}`}
                  fill
                  sizes="224px"
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 text-zinc-400">
                <QrCode className="h-8 w-8" aria-hidden />
                <span className="text-xs">No QR uploaded</span>
              </div>
            )}

            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <ScanLine className="h-3.5 w-3.5" aria-hidden />
              Scan with your e-wallet app
            </p>

            <dl className="w-full space-y-1.5 border-t border-zinc-100 pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Account name</dt>
                <dd className="font-medium text-zinc-900">{active.accountName}</dd>
              </div>
              {active.accountNumber && (
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Account number</dt>
                  <dd className="font-mono font-medium tabular-nums text-zinc-900">{active.accountNumber}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Instructions</h3>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{active.instructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}
