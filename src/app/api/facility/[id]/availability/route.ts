import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFacilityAvailability } from '@/lib/slots';
import { todayKey } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const facility = await prisma.facility.findUnique({
    where: { id, isActive: true },
    select: { id: true },
  });
  if (!facility) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
  }

  const url = new URL(_request.url);
  const date = url.searchParams.get('date');
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : todayKey();

  const courts = await getFacilityAvailability({ facilityId: id, dateKey });
  return NextResponse.json({ dateKey, courts });
}
