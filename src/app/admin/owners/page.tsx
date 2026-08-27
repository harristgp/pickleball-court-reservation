import { prisma } from '@/lib/prisma';
import { OwnerTable } from '@/components/admin/OwnerTable';

export default async function AdminOwnersPage() {
  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      facilities: {
        select: {
          id: true,
          isActive: true,
          _count: { select: { courts: true } },
          courts: { where: { isActive: true }, select: { id: true } },
        },
      },
      paymentMethods: { select: { id: true, isActive: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <OwnerTable
      owners={owners.map((owner) => ({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        isActive: owner.isActive,
        courtCount: owner.facilities.reduce((sum, f) => sum + f._count.courts, 0),
        activeCourtCount: owner.facilities.reduce(
          (sum, f) => sum + f.courts.length,
          0,
        ),
        paymentMethodCount: owner.paymentMethods.length,
        createdAt: owner.createdAt.toISOString(),
      }))}
    />
  );
}
