import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { Card, CardHeader } from '@/components/ui';
import { XenditReturnPoller } from '@/components/checkout/XenditReturnPoller';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payment status' };

/**
 * UX-only landing page for Xendit's `success_return_url`.
 * Proves nothing by itself — the poller reads the local booking status,
 * which only the authenticated webhook updates.
 */
export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await requireUser(`/checkout/${bookingId}/success`);

  const group = await prisma.bookingGroup.findUnique({
    where: { id: bookingId },
    select: { id: true, playerId: true },
  });
  if (!group) notFound();
  if (group.playerId !== user.id && user.role !== 'SUPER_ADMIN') notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/checkout/${bookingId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to checkout
      </Link>

      <Card className="p-5">
        <CardHeader
          title="Checking your payment"
          description="You are back from the secure checkout. We are confirming the result with the payment provider."
        />
        <div className="mt-2 px-5 pb-2">
          <XenditReturnPoller groupId={group.id} />
        </div>
      </Card>
    </div>
  );
}
