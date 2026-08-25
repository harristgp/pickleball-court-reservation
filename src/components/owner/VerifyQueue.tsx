'use client';

import { useState } from 'react';
import { CalendarDays, Clock, Hash, Receipt, User, Wallet, ZoomIn } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { Badge, Card, EmptyState } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { VerifyForm } from '@/components/owner/VerifyForm';

export interface QueueItem {
  bookingId: string;
  courtName: string;
  courtType: 'INDOOR' | 'OUTDOOR';
  playerName: string;
  playerEmail: string;
  dateLabel: string;
  timeLabel: string;
  amount: number;
  screenshotUrl: string;
  referenceNumber: string | null;
  amountClaimed: number | null;
  uploadedLabel: string;
}

/**
 * Side-by-side layout is deliberate: the owner is comparing what the booking
 * says it costs against what the screenshot says was sent, so both halves have
 * to be on screen at once. The modal exists only for zooming the receipt.
 */
export function VerifyQueue({ items }: { items: QueueItem[] }) {
  const [zoomed, setZoomed] = useState<QueueItem | null>(null);

  if (items.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Receipt className="h-6 w-6" aria-hidden />}
          title="Queue is clear"
          description="Receipts land here the moment a player uploads one."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => {
          const mismatch = item.amountClaimed !== null && Math.abs(item.amountClaimed - item.amount) > 0.009;

          return (
            <Card key={item.bookingId} className="overflow-hidden">
              <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-zinc-900">{item.playerName}</h3>
                    <Badge tone="amber">Awaiting verification</Badge>
                    {mismatch && <Badge tone="red">Amount mismatch</Badge>}
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Fact icon={<User className="h-3.5 w-3.5" aria-hidden />} label="Player" value={item.playerEmail} />
                    <Fact
                      icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
                      label="Date"
                      value={item.dateLabel}
                    />
                    <Fact
                      icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
                      label="Court & time"
                      value={`${item.courtName} · ${item.timeLabel}`}
                    />
                    <Fact
                      icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}
                      label="Booking total"
                      value={formatMoney(item.amount)}
                    />
                    <Fact
                      icon={<Receipt className="h-3.5 w-3.5" aria-hidden />}
                      label="Player says they sent"
                      value={item.amountClaimed === null ? 'Not stated' : formatMoney(item.amountClaimed)}
                      tone={mismatch ? 'danger' : undefined}
                    />
                    <Fact
                      icon={<Hash className="h-3.5 w-3.5" aria-hidden />}
                      label="Reference"
                      value={item.referenceNumber || 'Not provided'}
                    />
                  </dl>

                  <p className="text-xs text-zinc-400">Uploaded {item.uploadedLabel}</p>

                  <VerifyForm bookingId={item.bookingId} />
                </div>

                <button
                  type="button"
                  onClick={() => setZoomed(item)}
                  className="group relative flex min-h-[240px] items-center justify-center border-t border-zinc-100 bg-zinc-50 p-3 md:border-l md:border-t-0"
                  aria-label={`Zoom receipt from ${item.playerName}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.screenshotUrl}
                    alt={`Payment receipt from ${item.playerName}`}
                    className="max-h-64 w-auto rounded-lg object-contain shadow-card"
                  />
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-zinc-900/80 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5" aria-hidden />
                    Zoom
                  </span>
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={Boolean(zoomed)} onClose={() => setZoomed(null)} title={`Receipt — ${zoomed?.playerName ?? ''}`}>
        {zoomed && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomed.screenshotUrl}
              alt={`Payment receipt from ${zoomed.playerName}`}
              className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
            />
            <p className="text-center text-sm text-zinc-500">
              {zoomed.courtName} · {zoomed.dateLabel} · {zoomed.timeLabel} · {formatMoney(zoomed.amount)}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function Fact({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </dt>
      <dd className={tone === 'danger' ? 'mt-0.5 font-semibold text-red-600' : 'mt-0.5 font-medium text-zinc-900'}>
        {value}
      </dd>
    </div>
  );
}
