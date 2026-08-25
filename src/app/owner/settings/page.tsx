import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { Card, CardHeader } from '@/components/ui';
import { PaymentConfigForm, type PaymentMethodFormDefaults } from '@/components/owner/PaymentConfigForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payment settings' };

export default async function OwnerSettingsPage() {
  const { userId } = await requireOwner('/owner/settings');

  const methods = await prisma.paymentMethod.findMany({
    where: { ownerId: userId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const formMethods: PaymentMethodFormDefaults[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    accountName: m.accountName,
    accountNumber: m.accountNumber,
    qrCodeUrl: m.qrCodeUrl,
    instructions: m.instructions,
  }));

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

      <p className="flex items-start gap-2 rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        Uploads go through the configured storage driver — local disk by default, or UploadThing / Supabase Storage
        when <code className="font-mono">STORAGE_DRIVER</code> is switched. Whatever the driver returns is stored as a
        URL in each payment method, so swapping drivers needs no schema change.
      </p>
    </div>
  );
}
