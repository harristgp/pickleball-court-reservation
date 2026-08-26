import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const facility = await prisma.facility.findFirst({
    where: {
      OR: [
        { id },
        { owner: { id } },
      ],
      isActive: true,
      owner: { isActive: true },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (!facility) {
    redirect('/discover');
  }

  redirect(`/browse/facility/${facility.id}`);
}
