import type { BookingStatus } from '@prisma/client';
import { CheckCircle2, Clock, ShieldQuestion, XCircle } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui';
import { BOOKING_STATUS_LABEL } from '@/lib/types';

const STATUS_STYLE: Record<BookingStatus, { tone: BadgeTone; Icon: typeof Clock }> = {
  PENDING_PAYMENT: { tone: 'amber', Icon: Clock },
  PENDING_VERIFICATION: { tone: 'blue', Icon: ShieldQuestion },
  CONFIRMED: { tone: 'emerald', Icon: CheckCircle2 },
  REJECTED: { tone: 'red', Icon: XCircle },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { tone, Icon } = STATUS_STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {BOOKING_STATUS_LABEL[status]}
    </Badge>
  );
}
