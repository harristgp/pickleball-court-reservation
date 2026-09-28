import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { getSplitRuleId, isXenditConfigured } from '@/lib/xendit';
import { Card, CardHeader } from '@/components/ui';
import { PaymentConfigForm, type PaymentMethodFormDefaults } from '@/components/owner/PaymentConfigForm';
import { XenditPayoutForm } from '@/components/owner/XenditPayoutForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payment settings' };

export default async function OwnerSettingsPage() {
  const { userId } = await requireOwner('/owner/settings');

  const [methods, owner] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { ownerId: userId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { xenditSubAccountId: true },
    }),
  ]);

  const formMethods: PaymentMethodFormDefaults[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    accountName: m.accountName,
    accountNumber: m.accountNumber,
    qrCodeUrl: m.qrCodeUrl,
    instructions: m.instructions,
  }));

  const xenditLive = isXenditConfigured();
  const platformFeeNote = getSplitRuleId()
    ? 'A platform commission is deducted automatically before the remainder settles to you.'
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      <Card className="p-5">
        <CardHeader
          title="Payment methods"
          description="Players see these QR codes at checkout, then upload proof of payment. Add multiple methods (GCash, Maya, bank) so players can choose."
        />
        <div className="mt-5">
          <PaymentConfigForm methods={formMethods} />
        </div>
      </Card>

      <Card className="p-5">
        <CardHeader
          title="Online payouts (Xendit)"
          description={
            xenditLive
              ? 'Link your Xendit sub-account so player card, e-wallet, and bank payments settle into your own Xendit balance instead of the platform account.'
              : 'Online payments are not enabled on this deployment yet. Once enabled, link your sub-account here.'
          }
        />
        <div className="mt-5 space-y-4">
          {xenditLive && <XenditPayoutForm currentSubAccountId={owner?.xenditSubAccountId ?? null} />}
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-600">
            <li>Accept the PCourt sub-account invite (or ask the platform team to create one for you).</li>
            <li>Finish verification (KYC) and link your bank account inside the Xendit dashboard.</li>
            <li>Paste your sub-account Business ID above{!xenditLive && ' once online payments are enabled'}.</li>
            <li>
              Withdraw settled funds to your bank from the Xendit dashboard.
              {platformFeeNote && ` ${platformFeeNote}`}
            </li>
          </ol>
        </div>
      </Card>

      <p className="flex items-start gap-2 rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        Uploads go through the configured storage driver — local disk by default, or UploadThing / Supabase Storage
        when <code className="font-mono">STORAGE_DRIVER</code> is switched. Whatever the driver returns is stored as a
        URL in each payment method, so swapping drivers needs no schema change.
      </p>
    </div>
  );
}
