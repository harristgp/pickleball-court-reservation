import { Clock, DollarSign, QrCode } from 'lucide-react';
import { formatHour } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PaymentMethodSummary } from '@/lib/types';

export function FacilityDetails({
  description,
  openHour,
  closeHour,
  courtCount,
  minRate,
  maxRate,
  paymentMethod,
}: {
  description: string | null;
  openHour: number;
  closeHour: number;
  courtCount: number;
  minRate: number | null;
  maxRate: number | null;
  paymentMethod: PaymentMethodSummary | null;
}) {
  return (
    <div className="space-y-4">
      {description && (
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-600">{description}</p>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          <Clock className="h-4 w-4 text-zinc-400" aria-hidden />
          Open {formatHour(openHour)} – {formatHour(closeHour)}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          <DollarSign className="h-4 w-4 text-zinc-400" aria-hidden />
          {minRate !== null && maxRate !== null ? (
            minRate === maxRate ? (
              <span>{formatMoney(minRate)}/hr</span>
            ) : (
              <span>
                {formatMoney(minRate)} – {formatMoney(maxRate)}/hr
              </span>
            )
          ) : (
            <span>Contact for rates</span>
          )}
          <span className="text-zinc-400">·</span>
          <span>{courtCount} court{courtCount === 1 ? '' : 's'}</span>
        </div>

        {paymentMethod && (
          <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
            <QrCode className="h-4 w-4 text-brand-600" aria-hidden />
            Pay by {paymentMethod.name} to{' '}
            <span className="font-semibold text-zinc-800">{paymentMethod.accountName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
