import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function OwnerPage({ params }: { params: { id: string } }) {
  const facility = await prisma.facility.findFirst({
    where: {
      OR: [
        { id: params.id },
        { owner: { id: params.id } },
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
